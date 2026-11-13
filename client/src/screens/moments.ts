// Reacting to what happens, from any component: each caller gets its own subscription, made
// on mount and dropped on unmount. Handlers can change every render; the latest one is called.
//
// - useViewChanges: what changed with each new view (ViewChange: synced, joined, left, dealt,
//   ticketChanged, allIn, revealed, settled), once per new view, with the state it arrived in.
// - useGameEvents: the event stream (GameEvent: toast, fx, played, openTicket, bonked).
// - useMoments: both, through one handler.
//
// Nothing is replayed on mount: a component only hears what happens while it's mounted.
// The screen root already turns toasts, joins, leaves, removal and openTicket into toasts and
// popups (see GameRoot.tsx); don't handle those twice.
import { useEffect, useRef } from "react";
import type { GameEvent, ViewChange } from "../app/events.ts";
import type { AppState } from "../app/store.ts";
import { useGame } from "./game.tsx";

/** Anything worth reacting to: a change in the view, or an event. Both are tagged by `t`. */
export type Moment = ViewChange | GameEvent;

/** Keeps the newest handler without resubscribing each render. */
function useLatest<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

export function useViewChanges(handler: (change: ViewChange, state: AppState) => void) {
  const { store } = useGame();
  const latest = useLatest(handler);
  useEffect(() => store.subscribe((s, prev) => {
    if (s.room === prev.room || !s.room) return;
    for (const c of s.changes) latest.current(c, s);
  }), [store, latest]);
}

export function useGameEvents(handler: (event: GameEvent, state: AppState) => void) {
  const { store } = useGame();
  const latest = useLatest(handler);
  useEffect(() => store.events.on((e) => latest.current(e, store.getState())), [store, latest]);
}

export function useMoments(handler: (moment: Moment, state: AppState) => void) {
  useViewChanges(handler);
  useGameEvents(handler);
}
