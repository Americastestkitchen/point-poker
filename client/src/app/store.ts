// The client's single store: the server's view, who you are, the connection
// and local UI state, plus the event stream. Both the HUD and the 3D scene
// read it. Values that change every frame never go in here.
import { createStore as createZustand } from "zustand/vanilla";
import type { RoomState } from "../../../shared/protocol.ts";
import { createEvents, diff, type Events } from "./events.ts";

export interface AppState {
  screen: "start" | "creator" | "table";
  connection: { room: string; status: "idle" | "connecting" | "open" | "closed"; reason?: string };
  me: { id: string; isDealer: boolean } | null;
  room: RoomState | null;
  ui: {
    /** The card you just played; the server doesn't tell us our own vote. */
    myVote: number | null;
    /** The look editor is open over the table. */
    lookOpen: boolean;
  };
}

const initial: AppState = {
  screen: "start",
  connection: { room: "", status: "idle" },
  me: null,
  room: null,
  ui: { myVote: null, lookOpen: false },
};

export function createStore() {
  const store = createZustand<AppState>()(() => initial);
  const events: Events = createEvents();
  return Object.assign(store, {
    events,
    /** A new view from the server: keep it, then announce what changed. */
    receive(next: RoomState) {
      const { room: prev, me, ui } = store.getState();
      const evs = diff(prev, next);
      // keep our idea of our own vote in step with the table (new rounds, reconnects)
      const mine = next.players.find((p) => p.id === me?.id);
      const resetVote = next.phase !== "voting" || evs.some((e) => e.t === "dealt") || (!!mine && !mine.hasVoted);
      store.setState({ room: next, ui: resetVote && ui.myVote !== null ? { ...ui, myVote: null } : ui });
      for (const e of evs) events.emit(e);
    },
    setUi(patch: Partial<AppState["ui"]>) {
      store.setState((s) => ({ ui: { ...s.ui, ...patch } }));
    },
  });
}

export type Store = ReturnType<typeof createStore>;
