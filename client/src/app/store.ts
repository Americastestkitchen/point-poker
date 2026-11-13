// The client's single store: the server's view, who you are, the connection
// and local UI state, plus the event stream. Both the HUD and the 3D scene
// read it. Values that change every frame never go in here.
import { createStore as createZustand } from "zustand/vanilla";
import type { TableView } from "../../../shared/protocol.ts";
import { createEvents, diff, type Events } from "./events.ts";

export interface AppState {
  screen: "start" | "creator" | "table";
  connection: { room: string; status: "idle" | "connecting" | "open" | "closed"; reason?: string };
  /** Who you are at this table (from the welcome); your seat and role come from the view. */
  me: { id: string } | null;
  room: TableView | null;
  ui: {
    /** Your card: set the moment you play it, then kept in step with your view. */
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
    receive(next: TableView) {
      const { room: prev, me, ui } = store.getState();
      const evs = diff(prev, next);
      // your view always includes your own card, so a reload mid-vote remembers it
      const myVote = next.players.find((p) => p.id === me?.id)?.vote ?? null;
      store.setState({ room: next, ui: myVote !== ui.myVote ? { ...ui, myVote } : ui });
      for (const e of evs) events.emit(e);
    },
    setUi(patch: Partial<AppState["ui"]>) {
      store.setState((s) => ({ ui: { ...s.ui, ...patch } }));
    },
  });
}

export type Store = ReturnType<typeof createStore>;

/** Your own seat in the current view. */
export const myPlayer = (s: Pick<AppState, "me" | "room">) => s.room?.players.find((p) => p.id === s.me?.id);
