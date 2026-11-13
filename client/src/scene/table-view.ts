// The game on the table: a bean, a card and a chip stack per seat, the pot,
// and the ticket. It redraws from the store, and animates what the event
// stream says just happened.
import * as THREE from "three";
import { wornIn } from "../../../shared/look.ts";
import type { PublicPlayer, TableView } from "../../../shared/protocol.ts";
import { cardValues, voters } from "../../../shared/rules.ts";
import type { Actions } from "../app/actions.ts";
import type { GameEvent } from "../app/events.ts";
import type { Store } from "../app/store.ts";
import type { Audio } from "../audio/sfx.ts";
import { Avatar } from "../avatar.ts";
import type { CameraRig } from "./camera.ts";
import { TableCard } from "./cards.ts";
import { makeChip, stackChips } from "./chips.ts";
import { bonkMe } from "./effects.ts";
import type { StatusScreen } from "../environments/types.ts";
import type { Flights } from "./flights.ts";
import { layout } from "./layout.ts";
import type { Stage } from "./stage.ts";
import type { TicketPaper } from "./table.ts";

interface Seat {
  avatar: Avatar;
  unpick: () => void;
  card: TableCard;
  stack: THREE.Group;
  pos: THREE.Vector3;
  facing: number;
  slot: number;
  chipsShown: number;
}

/** Events that change how the next redraw animates; handled during the redraw. */
const DEFERRED = new Set<GameEvent["t"]>(["synced", "joined", "reshaped", "dealt", "revealed", "settled"]);

const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];

export function mountTableView(stage: Stage, deps: {
  store: Store; actions: Actions; audio: Audio; flights: Flights; rig: CameraRig;
  ticket: TicketPaper; pot: THREE.Group; screen: StatusScreen;
}) {
  const { store, actions, audio, flights, rig, ticket, pot, screen } = deps;
  const TABLE_Y = layout.table.y;
  const { scene, camera, picking } = stage;
  const seats = new Map<string, Seat>();
  let pending: GameEvent[] = [];
  let queued = false;

  const meId = () => store.getState().me?.id ?? "";

  // Redraw once per new view, after its events are in, so they can shape the animation.
  const schedule = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => { queued = false; redraw(); });
  };
  store.subscribe((s, prev) => { if (s.room !== prev.room || s.me !== prev.me) schedule(); });
  store.events.on((e) => {
    if (DEFERRED.has(e.t)) { pending.push(e); schedule(); return; }
    react(e);
  });

  const hatOf = (p: PublicPlayer) => wornIn(p.look, "head") ?? "none";

  function newAvatar(p: PublicPlayer) {
    const avatar = new Avatar(p.id, p.look.color, hatOf(p), p.isDealer, p.look.body);
    const unpick = p.id === meId() ? () => {} : picking.register(avatar.hitbox, () => actions.flick(p.id));
    return { avatar, unpick };
  }

  function redraw() {
    const st = store.getState().room;
    if (!st) return;
    const evs = pending;
    pending = [];
    const happened = (t: GameEvent["t"]) => evs.some((e) => e.t === t);
    const me = meId();
    const settled = evs.find((e) => e.t === "settled");
    const payingOut = settled?.t === "settled" && !settled.resettled;

    const players = st.players.filter((p) => !p.isDealer).sort((a, b) => a.seat - b.seat);
    const count = players.length;
    const slotOf = new Map<string, number>(players.map((p, i) => [p.id, i]));
    const revealed = st.phase === "revealed" || st.phase === "settled";

    // remove people who left
    for (const [id, seat] of seats) {
      if (!st.players.some((p) => p.id === id)) {
        scene.remove(seat.avatar.group, seat.card.group, seat.stack);
        seat.unpick();
        seats.delete(id);
      }
    }

    let flipIndex = 0;
    for (const p of st.players) {
      const slot = p.isDealer ? -1 : slotOf.get(p.id)!;
      let seat = seats.get(p.id);
      const info = layout.seat(slot, count);
      if (!seat) {
        const { avatar, unpick } = newAvatar(p);
        avatar.group.position.set(info.x, 0, info.z);
        avatar.group.rotation.y = info.facing;
        const stack = new THREE.Group();
        scene.add(avatar.group, stack);
        seat = { avatar, unpick, card: new TableCard(scene), stack, pos: new THREE.Vector3(info.x, 0, info.z), facing: info.facing, slot, chipsShown: -1 };
        seats.set(p.id, seat);
      }
      if (seat.avatar.shape !== p.look.body) {
        // new body shape: swap the model in place
        const old = seat.avatar;
        seat.unpick();
        const { avatar, unpick } = newAvatar(p);
        avatar.group.position.copy(old.group.position);
        avatar.group.rotation.y = old.group.rotation.y;
        scene.remove(old.group);
        scene.add(avatar.group);
        seat.avatar = avatar;
        seat.unpick = unpick;
      }
      seat.slot = slot;
      seat.pos.set(info.x, 0, info.z);
      seat.facing = info.facing;
      seat.card.placeAt(slot, count, p.id === me);
      const stack = layout.stack(slot, count);
      seat.stack.position.set(stack.x, stack.y, stack.z);
      seat.avatar.setStyle(p.look.color, hatOf(p));
      seat.avatar.setTag(p.name + (p.isDealer ? " 🎩" : ""), p.chips, p.look.color, p.connected);
      seat.avatar.group.visible = p.id !== me;
      seat.card.noFloat = p.id === me;

      if (p.id === me) rig.seat(info.x, info.z, p.isDealer, happened("synced"));

      // speech bubble showing whether they've bet
      seat.avatar.setBubble(st.phase === "voting" && p.plays ? (p.hasVoted ? "✓" : "…") : "");

      // their card on the felt
      if (st.phase === "voting") {
        if (p.hasVoted) {
          const mine = p.id === me ? store.getState().ui.myVote : null;
          if (!seat.card.group.visible) {
            if (p.id === me) {
              seat.card.show(mine, camera.localToWorld(new THREE.Vector3(0, -0.3, -0.5)));
              seat.card.nudge(0.5);
              audio.slide();
            } else {
              // they lean in, set it down from their hand, then square it up
              const av = seat.avatar;
              av.placeCard();
              seat.card.show(mine, () => av.handWorldPos(), { delay: 0.3, gentle: true });
              seat.card.nudge(0.75);
              setTimeout(audio.slide, 300);
            }
          } else seat.card.show(mine);
          seat.card.faceUp(false);
        } else seat.card.hide();
      } else if (revealed && p.vote !== null) {
        if (!seat.card.group.visible) seat.card.show(null);
        if (!seat.card.isFaceUp) {
          // on the reveal, cards flip one after another
          const stagger = happened("revealed");
          const card = seat.card, value = p.vote, delay = stagger ? 250 * flipIndex++ : 0;
          setTimeout(() => { card.show(value); card.faceUp(true); if (delay || stagger) audio.flip(); }, delay);
          card.faceUp(true);
          card.show(card.value);
        }
      } else seat.card.hide();

      // personal chip stack (winners' stacks update after the chips land)
      if (seat.chipsShown !== p.chips && !(payingOut && st.winners.includes(p.id))) {
        stackChips(seat.stack, p.chips, p.seat + 7);
        seat.chipsShown = p.chips;
      }
    }

    if (happened("dealt")) audio.deal();

    // the pot
    if (st.phase === "revealed") {
      if (happened("revealed") || !pot.children.length) {
        stackChips(pot, st.pot, 99);
        pot.children.forEach((c, i) => {
          const to = c.position.clone();
          c.position.y += 0.6 + i * 0.01;
          flights.add({ obj: c, from: c.position.clone(), to, t: -i * 0.03, dur: 0.35, arc: 0, spin: 0, done: () => i % 3 === 0 && audio.chip() });
        });
      }
    } else if (payingOut) {
      payOut(st);
    } else if (st.phase !== "settled") {
      pot.clear();
    }
    if (settled?.t === "settled" && settled.resettled) pot.clear();
    if (settled) {
      for (const id of st.winners) seats.get(id)?.avatar.celebrate();
      if (st.winners.includes(me)) audio.win(); else audio.chip();
    }

    // people arriving wave; people who changed shape gasp
    for (const e of evs) {
      if ((e.t === "joined" || e.t === "reshaped") && e.player.id !== me) {
        seats.get(e.player.id)?.avatar.playEmote(e.t === "joined" ? "wave" : "shock");
        audio.pop();
      }
    }

    // the ticket on the table and on the status screen
    const t = st.ticket;
    ticket.set(t ? {
      key: t.key, type: t.type, summary: t.summary,
      points: st.finalPoints !== null && st.phase === "settled" ? `${st.finalPoints} PTS` : "",
    } : null);
    const playing = voters(st.players);
    const tvLine3 = st.phase === "voting" ? `${playing.filter((p) => p.hasVoted).length}/${playing.length} BETS IN`
      : st.phase === "revealed" ? `POT ${st.pot}` : st.phase === "settled" ? `FINAL ${st.finalPoints} PTS` : "";
    screen.show(t?.key ?? "NO TICKET", t?.summary ?? "the dealer is shuffling the backlog", tvLine3);
  }

  /** The pot's chips fly to the winners; their stacks grow when the chips land. */
  function payOut(st: TableView) {
    const winners = st.winners.map((id) => seats.get(id)).filter(Boolean) as Seat[];
    const chips = [...pot.children];
    if (!winners.length) { pot.clear(); return; }
    chips.forEach((chip, i) => {
      const seat = winners[i % winners.length];
      const from = chip.getWorldPosition(new THREE.Vector3());
      pot.remove(chip);
      scene.add(chip);
      chip.position.copy(from);
      flights.add({
        obj: chip, from, to: () => seat.stack.getWorldPosition(new THREE.Vector3()).setY(TABLE_Y + 0.05),
        t: -0.6 - i * 0.04, dur: 0.6, arc: 0.4, spin: 8,
        done: () => { scene.remove(chip); if (i % 2 === 0) audio.chip(); },
      });
    });
    const total = 0.6 + chips.length * 0.04 + 0.7;
    setTimeout(() => {
      const now = store.getState().room;
      if (!now) return;
      for (const p of now.players) {
        const s = seats.get(p.id);
        if (s && s.chipsShown !== p.chips) { stackChips(s.stack, p.chips, p.seat + 7); s.chipsShown = p.chips; }
      }
    }, total * 1000);
  }

  function headOf(id: string): THREE.Vector3 {
    if (id === meId()) return camera.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, -0.05, 0));
    return seats.get(id)?.avatar.headWorldPos() ?? new THREE.Vector3();
  }

  /** A chip flies from one head to another, bonks, and rolls away. */
  function flick(from: string, to: string) {
    const chip = makeChip(pick(["#c0392b", "#2d6cdf", "#151515", "#e6be5a"]));
    const start = from === meId() ? camera.localToWorld(new THREE.Vector3(0.15, -0.2, -0.3)) : headOf(from);
    chip.position.copy(start);
    scene.add(chip);
    flights.add({
      obj: chip, from: start, to: () => headOf(to), t: 0, dur: 0.55, arc: 0.35, spin: 25,
      done: () => {
        audio.bonk();
        if (to === meId()) bonkMe();
        else seats.get(to)?.avatar.bonk();
        // the chip bounces off and rolls away
        const bounce = chip.position.clone();
        const away = bounce.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 0, (Math.random() - 0.5) * 0.8)).setY(TABLE_Y + 0.01);
        flights.add({ obj: chip, from: bounce, to: away, t: 0, dur: 0.5, arc: 0.25, spin: 12, done: () => setTimeout(() => scene.remove(chip), 1500) });
      },
    });
  }

  /** Effects that don't wait for a redraw. */
  function react(e: GameEvent) {
    switch (e.t) {
      case "gaze": seats.get(e.id)?.avatar.setLook(e.yaw, e.pitch); return;
      case "talk": seats.get(e.id)?.avatar.setTalk(e.level); return;
      case "emote": seats.get(e.id)?.avatar.playEmote(e.emote); audio.pop(); return;
      case "flick": flick(e.from, e.to); return;
      case "adjust": {
        // someone swapped their card: they reach in and fiddle with it
        const s = seats.get(e.id);
        if (s && s.card.group.visible) { s.avatar.adjustCard(); s.card.nudge(0.2); }
        return;
      }
      case "played": {
        // your card flies from your hand to the felt
        const seat = seats.get(meId());
        const deck = cardValues(store.getState().room?.settings.deck ?? []);
        if (seat) {
          const i = deck.indexOf(e.value);
          const from = camera.localToWorld(new THREE.Vector3((i - (deck.length - 1) / 2) * 0.06, -0.35, -0.5));
          if (e.changed) seat.card.hide();
          seat.card.show(e.value, from);
          seat.card.faceUp(false);
        }
        audio.slide();
        return;
      }
    }
  }

  return {
    update(dt: number, t: number) {
      const voting = store.getState().room?.phase === "voting";
      for (const s of seats.values()) {
        s.avatar.group.position.lerp(s.pos, Math.min(1, dt * 4));
        let dr = s.facing - s.avatar.group.rotation.y;
        dr = Math.atan2(Math.sin(dr), Math.cos(dr));
        s.avatar.group.rotation.y += dr * Math.min(1, dt * 4);
        s.avatar.update(dt, t);
        // idle fidget: now and then someone straightens their face-down card
        if (voting && s.card.group.visible && !s.card.isFaceUp && s.avatar.group.visible && !s.avatar.busyWithCard && Math.random() < dt / 11) {
          s.avatar.adjustCard();
          s.card.nudge(0.2);
        }
        s.card.update(dt);
      }
    },
  };
}
