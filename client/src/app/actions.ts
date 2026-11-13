// Everything the player can do. The UI and the scene call these; nothing else
// sends messages to the server.
import type { Body, ClientMsg, Emote, Hat } from "../../../shared/protocol.ts";
import type { Session } from "./session.ts";
import type { Store } from "./store.ts";

/** How long you wait between chip flicks. */
export const FLICK_COOLDOWN_MS = 600;

export function createActions(session: Pick<Session, "send">, store: Store, clock: { now(): number } = performance) {
  const send = (m: ClientMsg) => session.send(m);
  let lastFlick = -Infinity;

  const me = () => {
    const { room, me } = store.getState();
    return room?.players.find((p) => p.id === me?.id);
  };

  return {
    /** Put a card down (or swap the one you put down). */
    vote(value: number) {
      const { room, ui } = store.getState();
      if (room?.phase !== "voting" || !me()?.plays || ui.myVote === value) return;
      const changed = ui.myVote !== null;
      store.setUi({ myVote: value });
      send({ t: "vote", value });
      store.events.emit({ t: "played", value, changed });
    },
    /** Flick a chip at someone's head. */
    flick(target: string) {
      const now = clock.now();
      if (now - lastFlick < FLICK_COOLDOWN_MS) return;
      lastFlick = now;
      send({ t: "flick", target });
    },
    emote: (kind: Emote) => send({ t: "emote", kind }),
    /** Where you're looking, relative to facing the table. */
    gaze: (yaw: number, pitch: number) => send({ t: "look", yaw, pitch }),
    /** Mic loudness 0..1 (never audio). */
    talk: (level: number) => send({ t: "talk", level }),
    restyle: (look: { color: string; hat: Hat; body: Body }) => send({ t: "style", ...look }),
    openTicket: () => store.events.emit({ t: "openTicket" }),

    dealer: {
      load: (ref: string) => send({ t: "loadTicket", ref }),
      typeIn: (summary: string) => send({ t: "manualTicket", key: "", summary, description: "" }),
      loadSprint: () => send({ t: "fetchQueue" }),
      clearQueue: () => send({ t: "clearQueue" }),
      setPlays: (plays: boolean) => send({ t: "dealerPlays", plays }),
      deal: () => send({ t: "deal" }),
      reveal: () => send({ t: "reveal" }),
      settle: (finalPoints: number) => send({ t: "settle", finalPoints }),
      next: () => send({ t: "nextRound" }),
      cancel: () => send({ t: "cancelRound" }),
      skip: () => send({ t: "skip" }),
      kick: (id: string) => send({ t: "kick", id }),
    },
  };
}

export type Actions = ReturnType<typeof createActions>;
