// What every game screen gets: the injected services (useGame) and the store, read the React
// way (useAppState). Screens derive what they show while rendering; they never copy the room,
// players or phase into component state, and they write only through named store methods
// and actions.
import { createContext, useContext, useSyncExternalStore } from "react";
import type { Actions } from "../app/actions.ts";
import type { Storage } from "../app/storage.ts";
import { myPlayer, type AppState, type Popup, type Store } from "../app/store.ts";
import type { MicStatus } from "../audio/mic.ts";
import type { Audio } from "../audio/sfx.ts";
import type { Toasts } from "../ui/index.ts";
import type { Copy } from "./copy.ts";
import type { MicControl } from "./mic.ts";
import type { TicketLoad, TicketLoadState } from "./ticket-load.ts";

/** The game UI's services. createGameUi() builds one; tests can build their own. */
export interface Game {
  store: Store;
  actions: Actions;
  storage: Storage;
  /** Sound effects (it's also the kit's `sounds`, so mute covers both). */
  audio: Audio;
  /** The one toast stack (the kit's <Toaster> draws it). */
  toasts: Toasts;
  /** The mic button's state and toggle; read the status with useMicStatus(). */
  mic: MicControl;
  /** Fetching a ticket: the dock's "Next", the dealer's "Skip" and the picker. See useTicketLoad(). */
  ticketLoad: TicketLoad;
  /** Clipboard with an in-game fallback dialog. */
  copy: Copy;
  /** Leaves this table for the title screens. */
  leaveTable(): void;
  /** Copies the invite link ("🔗 Invite link copied…"), or shows it to copy by hand. */
  invite(): void;
  /**
   * A dealer action nobody waits on: if the server says no, its reason shows once as an error
   * toast (with the bonk). Don't also show it in a form: a form that awaits the action itself
   * shows its own error instead of calling this.
   */
  dealerDo(work: Promise<void>): void;
}

const GameContext = createContext<Game | null>(null);
export const GameProvider = GameContext;

export function useGame(): Game {
  const game = useContext(GameContext);
  if (!game) throw new Error("Game screens need a <GameProvider> (createGameUi adds one)");
  return game;
}

/**
 * Part of the app state, re-rendering when it changes. `select` must return something stable
 * (a slice of the state, or a primitive): build new objects and arrays during render instead.
 */
export function useAppState<T>(select: (s: AppState) => T): T {
  const { store } = useGame();
  return useSyncExternalStore(store.subscribe, () => select(store.getState()));
}

/** The table as the server last showed it, or null before the first view. */
export const useRoom = () => useAppState((s) => s.room);

/** Your seat in the current view (it follows the dealer role if that moves). */
export const useMe = () => useAppState(myPlayer);

/** One popup's open state, and named ways to open and close it. */
export function usePopup(popup: Popup) {
  const { store } = useGame();
  const open = useAppState((s) => s.ui.popup === popup);
  return { open, show: () => store.popupOpened(popup), close: () => store.popupClosed(popup) };
}

export function useTicketLoad(): TicketLoadState {
  const { ticketLoad } = useGame();
  return useSyncExternalStore(ticketLoad.subscribe, ticketLoad.get);
}

export function useMicStatus(): MicStatus {
  const { mic } = useGame();
  return useSyncExternalStore(mic.subscribe, mic.status);
}
