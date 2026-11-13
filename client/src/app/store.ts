// The client's single store: the server's view and what changed in it, who
// you are, the connection and local UI state, plus the event stream. Both the
// screens and the 3D scene read it. Values that change every frame never go in here.
import { createStore as createZustand } from "zustand/vanilla";
import type { Look } from "../../../shared/look.ts";
import type { TableView } from "../../../shared/protocol.ts";
import type { Connection } from "./connection.ts";
import { createEvents, diff, type Events, type ViewChange } from "./events.ts";
import { vote, type VoteState } from "./vote.ts";

/** A box on the screen in CSS pixels, from the top-left of the window. */
export interface ScreenRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Your bean on show (the title screens and the look editor): the 3D world draws it, spotlit on
 * its turntable, into `rect`, a space the screen leaves for it. `look` is the draft as you edit it.
 */
export interface Showcase {
  look: Look;
  /** In the dealer's gear: you opened this table. */
  dealer: boolean;
  rect: ScreenRect;
}

export interface AppState {
  /** The title screens (menu, character select, invite) until you sit down, then the table. */
  screen: "title" | "table";
  connection: Connection;
  /** Who you are at this table (from the welcome); your seat and role come from the view. */
  me: { id: string } | null;
  room: TableView | null;
  /** Your bean on show, or null when no screen shows it. */
  showcase: Showcase | null;
  /** What changed with the latest view. It arrives in the same update, so whoever redraws sees both at once. */
  changes: ViewChange[];
  /** Your card (see vote.ts), plus local UI state. */
  ui: VoteState & {
    /** The look editor is open over the table. */
    lookOpen: boolean;
    /** The one popup open over the table, if any. */
    popup: Popup | null;
  };
}

/**
 * The popups over the table. One at a time: opening one closes the other. A confirm
 * asked from inside one stays local to it (a nested dialog), not a popup of its own.
 */
export const POPUPS = ["menu", "options", "help", "leaderboard", "dealer", "picker", "ticket"] as const;
export type Popup = (typeof POPUPS)[number];

const initial: AppState = {
  screen: "title",
  connection: { status: "idle" },
  me: null,
  room: null,
  showcase: null,
  changes: [],
  ui: { myVote: null, votesInFlight: 0, lookOpen: false, popup: null },
};

export function createStore(): Store {
  return build();
}

/** The store with zustand's setState still on it; only this file sees that. */
function build() {
  const store = createZustand<AppState>()(() => initial);
  const events: Events = createEvents();
  return Object.assign(store, {
    events,
    /** A new view from the server: keep it, together with what changed since the last one. */
    receive(next: TableView) {
      const { room: prev, me, ui } = store.getState();
      // your view always includes your own card, so a reload mid-vote remembers it
      const server = next.players.find((p) => p.id === me?.id)?.vote ?? null;
      store.setState({ room: next, changes: diff(prev, next), ui: withVote(ui, { t: "view", server }) });
    },
    /** You played a card, or the server answered one you played. */
    vote(a: { t: "played"; value: number } | { t: "answered" }) {
      const s = store.getState();
      const action = a.t === "played" ? a : { t: "answered" as const, server: myPlayer(s)?.vote ?? null };
      store.setState({ ui: withVote(s.ui, action) });
    },
    setUi(patch: Partial<AppState["ui"]>) {
      store.setState((s) => ({ ui: { ...s.ui, ...patch } }));
    },
    /** `popup` opened over the table, replacing whichever one was open. */
    popupOpened(popup: Popup) {
      const { ui } = store.getState();
      if (ui.popup !== popup) store.setState({ ui: { ...ui, popup } });
    },
    /** `popup` closed. Nothing happens if it isn't the one open (another one replaced it already). */
    popupClosed(popup: Popup) {
      const { ui } = store.getState();
      if (ui.popup === popup) store.setState({ ui: { ...ui, popup: null } });
    },
    /** The line to the table moved on (see connection.ts). */
    connectionChanged(connection: Connection) {
      store.setState({ connection });
    },
    /** The server welcomed you to the table as `playerId`. */
    welcomed(playerId: string) {
      store.setState({ me: { id: playerId } });
    },
    /** "Change look" opened the look editor over the table. */
    lookOpened() {
      store.setState((s) => ({ ui: { ...s.ui, lookOpen: true } }));
    },
    /** The look editor closed (Done or Back). */
    lookClosed() {
      store.setState((s) => ({ ui: { ...s.ui, lookOpen: false } }));
    },
    /**
     * A screen shows your bean: here, like this. One screen at a time shows it; the newest wins.
     * Nothing changes if it's the same box and look as now.
     */
    showcased(showcase: Showcase) {
      const prev = store.getState().showcase;
      if (prev && sameShowcase(prev, showcase)) return;
      store.setState({ showcase });
    },
    /** The screen that showed `showcase` stopped. Left alone if another screen's showcase replaced it. */
    showcaseEnded(showcase: Showcase) {
      const now = store.getState().showcase;
      if (now && sameShowcase(now, showcase)) store.setState({ showcase: null });
    },
    /** You sat down at the table. */
    seated() {
      store.setState({ screen: "table" });
    },
  });
}

/** The store without zustand's raw setState: every write goes through a named method above. */
export type Store = Omit<ReturnType<typeof build>, "setState">;

/** The UI state with the vote reducer applied, the same object if nothing changed. */
function withVote(ui: AppState["ui"], a: Parameters<typeof vote>[1]): AppState["ui"] {
  const next = vote(ui, a);
  return next === ui ? ui : { ...ui, ...next };
}

const sameShowcase = (a: Showcase, b: Showcase) =>
  a.look === b.look &&
  a.dealer === b.dealer &&
  a.rect.x === b.rect.x &&
  a.rect.y === b.rect.y &&
  a.rect.width === b.rect.width &&
  a.rect.height === b.rect.height;

/** Your own seat in the current view. */
export const myPlayer = (s: Pick<AppState, "me" | "room">) => s.room?.players.find((p) => p.id === s.me?.id);
