// The game on the table: a seat per player, the pot, and the ticket. It
// redraws from the store, and animates what the event stream says just happened.
import * as THREE from "three";
import type { Fx } from "../../../../shared/protocol.ts";
import { cardValues, voters } from "../../../../shared/rules.ts";
import type { Actions } from "../../app/actions.ts";
import type { GameEvent, ViewChange } from "../../app/events.ts";
import type { Store } from "../../app/store.ts";
import type { Audio } from "../../audio/sfx.ts";
import { PLACE_PAT, SWAP_GRAB, SWAP_SLAP } from "../../avatar/animator.ts";
import type { Avatar } from "../../avatar/avatar.ts";
import type { StatusScreen } from "../../environments/types.ts";
import type { CameraRig } from "../engine/camera.ts";
import type { Stage } from "../engine/stage.ts";
import type { Layout } from "../layout/layout.ts";
import type { Flights } from "./flights.ts";
import { createItemPlays } from "./items.ts";
import { potMove, type Pot } from "./pot.ts";
import { createSeat, type Seat } from "./seat.ts";
import type { TicketPaper } from "./ticket.ts";

export interface TableView {
  /** Your bean, while you're at the table. It's hidden on your screen; your first-person body copies it. */
  mine(): Avatar | null;
  update(dt: number, t: number): void;
}

export function mountTableView(
  stage: Stage,
  deps: {
    store: Store;
    actions: Actions;
    audio: Audio;
    layout: Layout;
    flights: Flights;
    rig: CameraRig;
    ticket: TicketPaper;
    pot: Pot;
    screen: Pick<StatusScreen, "show">;
  },
): TableView {
  const { store, actions, audio, layout, flights, rig, ticket, pot, screen } = deps;
  const { camera } = stage;
  const seats = new Map<string, Seat>();

  const meId = () => store.getState().me?.id ?? "";
  const items = createItemPlays(stage, {
    audio,
    layout,
    flights,
    events: store.events,
    me: meId,
    seat: (id) => seats.get(id),
    flattened: rig.flatten,
  });

  // Each new view redraws the table, and what changed in it shapes the animation.
  store.subscribe((s, prev) => {
    if (s.room !== prev.room) redraw(s.changes);
    else if (s.me !== prev.me) redraw([]);
    // a refused vote hands your card back to the view; while votes are out, the card you played stays put
    else if (s.ui.myVote !== prev.ui.myVote && !s.ui.votesInFlight) redraw([]);
  });
  store.events.on(react);

  function redraw(changes: readonly ViewChange[]) {
    const st = store.getState().room;
    if (!st) return;
    const happened = (t: ViewChange["t"]) => changes.some((c) => c.t === t);
    const me = meId();
    const settled = changes.find((c) => c.t === "settled");
    const potDoes = potMove(pot.state, {
      phase: st.phase,
      revealedNow: happened("revealed"),
      settledNow: !!settled,
      resettled: settled?.t === "settled" && settled.resettled,
    });
    const payingOut = potDoes === "payOut";

    const players = st.players.filter((p) => !p.isDealer).toSorted((a, b) => a.seat - b.seat);
    const count = players.length;
    const slotOf = new Map<string, number>(players.map((p, i) => [p.id, i]));
    const revealed = st.phase === "revealed" || st.phase === "settled";

    // people who left
    for (const [id, seat] of seats) {
      if (!st.players.some((p) => p.id === id)) {
        seat.remove();
        seats.delete(id);
      }
    }

    let flipIndex = 0;
    for (const p of st.players) {
      const slot = slotOf.get(p.id) ?? -1; // the dealer has no slot
      const mine = p.id === me;
      let seat = seats.get(p.id);
      if (!seat) {
        // clicking someone uses the hand item you've picked on them
        seat = createSeat(stage, p, { layout, onPick: mine ? undefined : () => actions.items.use(p.id) });
        seats.set(p.id, seat);
      }
      seat.place(slot, count, mine);
      const { avatar, card } = seat;
      avatar.setLook(p.look);
      avatar.setTag(p.name + (p.isDealer ? " 🎩" : ""), p.chips, p.look.color, p.connected);
      avatar.setFirstPerson(mine);

      if (mine) {
        const s = layout.seat(slot, count);
        rig.seat(s.x, s.z, p.isDealer, happened("synced"));
      }

      // speech bubble showing whether they've bet
      avatar.setBubble(st.phase === "voting" && p.plays ? (p.hasVoted ? "✓" : "…") : "");

      // their card on the felt
      if (st.phase === "voting") {
        // your own card follows your hand, so a view from before your vote can't snatch it off the felt
        const myVote = store.getState().ui.myVote;
        if (mine ? myVote !== null : p.hasVoted) {
          const value = mine ? myVote : null;
          if (!card.group.visible) {
            if (mine) {
              card.show(value, camera.localToWorld(new THREE.Vector3(0, -0.3, -0.5)));
              card.nudge(0.5);
              audio.slide();
            } else {
              // they lean in, set it down from their hand and pat it
              avatar.play("placeCard");
              card.show(value, () => avatar.handWorldPos(), { delay: 0.3, gentle: true });
              card.nudge(PLACE_PAT);
              stage.after(0.3, audio.slide);
            }
          } else card.show(value);
          card.turnDown();
        } else card.hide();
      } else if (revealed && p.vote !== null) {
        // your own card follows your hand, so a swap you just made doesn't snap back while it's on its way
        const myVote = store.getState().ui.myVote;
        const value = mine && myVote !== null ? myVote : p.vote;
        if (!card.group.visible) card.show(null);
        if (!card.isFaceUp) {
          // on the reveal, cards turn one after another
          const stagger = happened("revealed");
          card.turnUp(value, {
            delay: stagger ? 0.25 * flipIndex++ : 0,
            onTurn: stagger ? () => audio.flip() : undefined,
          });
        } else if (card.value !== value) swapCard(seat, value, mine); // they changed their mind
        card.setWas(p.revealedVote);
      } else card.hide();

      // chip stack (winners' stacks update after the chips land)
      if (!(payingOut && st.winners.includes(p.id))) seat.showChips(p.chips, p.seat + 7);
    }

    if (happened("dealt")) audio.deal();

    // the pot
    if (potDoes === "fill") pot.fill(st.pot);
    else if (st.phase === "revealed") pot.restack(st.pot);
    else if (potDoes === "clear") pot.clear();
    else if (potDoes === "payOut") {
      const winners = st.winners.map((id) => seats.get(id)).filter((s): s is Seat => !!s);
      pot.payOut(winners, () => {
        const now = store.getState().room;
        for (const p of now?.players ?? []) seats.get(p.id)?.showChips(p.chips, p.seat + 7);
      });
    }
    if (settled) {
      for (const id of st.winners) seats.get(id)?.avatar.play("celebrate");
      if (st.winners.includes(me)) audio.win();
      else audio.chip();
    }

    // people arriving wave; people who changed shape gasp
    for (const c of changes) {
      if ((c.t === "joined" || c.t === "reshaped") && c.player.id !== me) {
        seats.get(c.player.id)?.avatar.play(c.t === "joined" ? "wave" : "shock");
        audio.pop();
      }
    }

    // the ticket on the table and on the status screen
    const t = st.ticket;
    ticket.set(
      t
        ? {
            key: t.key,
            type: t.type,
            summary: t.summary,
            points: st.finalPoints !== null && st.phase === "settled" ? `${st.finalPoints} PTS` : "",
          }
        : null,
    );
    const playing = voters(st.players);
    const status =
      st.phase === "voting"
        ? `${playing.filter((p) => p.hasVoted).length}/${playing.length} BETS IN`
        : st.phase === "revealed"
          ? `POT ${st.pot}`
          : st.phase === "settled"
            ? `FINAL ${st.finalPoints} PTS`
            : "";
    screen.show(t?.key ?? "NO TICKET", t?.summary ?? "the dealer is shuffling the backlog", status);
  }

  /** After the reveal: the bean grabs its card back off the felt and slaps the new one down, face up. */
  function swapCard(seat: Seat, value: number, mine: boolean) {
    seat.avatar.play("swapCard");
    // your own comes up in front of your eyes; everyone else's in their bean's hand
    const hand = mine
      ? () => camera.localToWorld(new THREE.Vector3(0.12, -0.12, -0.45))
      : () => seat.avatar.handWorldPos();
    seat.card.swap(value, hand, { grab: SWAP_GRAB, slap: SWAP_SLAP, onSlap: audio.slap });
  }

  /** What someone's effect looks like at the table. */
  function play(from: string, fx: Fx) {
    const seat = seats.get(from);
    switch (fx.kind) {
      case "gaze":
        seat?.avatar.setGaze(fx.yaw, fx.pitch);
        return;
      case "talk":
        seat?.avatar.setTalk(fx.level);
        return;
      case "emote":
        seat?.avatar.play(fx.emote);
        audio.pop();
        return;
      case "use":
        items.play(from, fx.item, fx.to);
        return;
      case "flick":
        return; // for tabs opened before hand items; this one played the chip's "use"
      case "squeak":
        return; // the room's squeaky plays it (scene/index.ts)
      case "adjust":
        // someone swapped their card: they reach in and square it up (you see your own on "played")
        if (seat && seat.card.group.visible) {
          seat.avatar.play("adjustCard");
          seat.card.nudge(0.2);
        }
        return;
      default:
        fx satisfies never;
    }
  }

  /** Effects that don't wait for a redraw. */
  function react(e: GameEvent) {
    switch (e.t) {
      case "fx":
        play(e.from, e.fx);
        return;
      case "played": {
        const seat = seats.get(meId());
        if (seat && store.getState().room?.phase === "revealed") {
          // changing your mind during the discussion: face up, for everyone to see
          if (seat.card.group.visible) swapCard(seat, e.value, true);
          return;
        }
        if (seat) {
          if (e.changed && seat.card.group.visible) {
            // swapping it: the card stays on the felt and both hands square it up, as everyone sees
            seat.card.show(e.value);
            seat.avatar.play("adjustCard");
            seat.card.nudge(0.2);
          } else {
            // your card flies from your hand to the felt, and your arm puts it down and pats it
            const deck = cardValues(store.getState().room?.settings.deck ?? []);
            const i = deck.indexOf(e.value);
            const from = camera.localToWorld(new THREE.Vector3((i - (deck.length - 1) / 2) * 0.06, -0.35, -0.5));
            seat.card.show(e.value, from);
            seat.avatar.play("placeCard");
          }
          seat.card.turnDown();
        }
        audio.slide();
        return;
      }
      default:
        return; // the rest are for the screens
    }
  }

  // a view that arrived while the room was still loading: draw it now, as the first one
  if (store.getState().room) redraw([{ t: "synced" }]);

  return {
    mine: () => seats.get(meId())?.avatar ?? null,
    update(dt, t) {
      for (const s of seats.values()) s.update(dt, t);
    },
  };
}
