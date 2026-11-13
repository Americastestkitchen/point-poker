// The game's screens, ready to mount: main.ts passes `ui` to the one game mountUi() call and
// gives `allowsWorldKeys` to the scene's input, so world shortcuts never fire under the UI.
import type { ReactNode } from "react";
import type { Actions } from "../app/actions.ts";
import type { Storage } from "../app/storage.ts";
import type { Store } from "../app/store.ts";
import type { Mic } from "../audio/mic.ts";
import type { Audio } from "../audio/sfx.ts";
import type { Toasts } from "../ui/index.ts";
import { createCopy, type ClipboardLike } from "./copy.ts";
import { GameProvider, type Game } from "./game.tsx";
import { GameRoot } from "./GameRoot.tsx";
import { focusOf, worldKeysAllowed } from "./keys.ts";
import { createMicControl } from "./mic.ts";
import { createTicketLoad } from "./ticket-load.ts";

export interface GameUiDeps {
  store: Store;
  actions: Actions;
  storage: Storage;
  audio: Audio;
  mic: Mic;
  /** The same instance mountUi() gets as `toasts`, so <Toaster> draws what screens show. */
  toasts: Toasts;
  /** Opens the look editor over the table. */
  openLook(): void;
  /** Leaves the table for the start screen. */
  leaveTable(): void;
  /** This table's invite link. */
  inviteUrl(): string;
  /** The clipboard, if the browser gives us one (not on plain http). */
  clipboard?: () => ClipboardLike | undefined;
}

export interface GameUi {
  /** The screen tree, for mountUi(). */
  ui: ReactNode;
  /** May the 3D world take this key press (emotes, recenter)? False while the UI has the keyboard. */
  allowsWorldKeys(): boolean;
  /** Lets go of the mic and timers; call it after unmounting `ui`. */
  dispose(): void;
}

/** Builds the game UI's services (starting the mic if you had it on) and the screen tree. */
export function createGameUi(deps: GameUiDeps): GameUi {
  const { store, actions, storage, audio, toasts } = deps;
  const after = (ms: number, fn: () => void) => {
    const timer = setTimeout(fn, ms);
    return () => clearTimeout(timer);
  };
  const mic = createMicControl({ mic: deps.mic, storage, actions, toasts, after });
  const ticketLoad = createTicketLoad({ openPicker: () => store.popupOpened("picker"), bonk: () => audio.bonk() });
  const copy = createCopy({ clipboard: deps.clipboard ?? (() => navigator.clipboard), toasts });

  const game: Game = {
    store,
    actions,
    storage,
    audio,
    toasts,
    mic,
    ticketLoad,
    copy,
    openLook: deps.openLook,
    leaveTable: deps.leaveTable,
    invite: () =>
      void copy.copy(deps.inviteUrl(), {
        done: "🔗 Invite link copied. Paste it in Slack or Teams.",
        title: "Send this link to your team",
      }),
    // through the event stream, so the root's one adapter shows it (and bonks)
    dealerDo: (work) =>
      void work.catch((e: unknown) => {
        store.events.emit({ t: "toast", text: e instanceof Error ? e.message : String(e), level: "error" });
      }),
  };

  return {
    ui: (
      <GameProvider value={game}>
        <GameRoot />
      </GameProvider>
    ),
    allowsWorldKeys() {
      const s = store.getState();
      return worldKeysAllowed({
        screen: s.screen,
        popup: s.ui.popup,
        lookOpen: s.ui.lookOpen,
        dialogOpen: document.querySelector("[role='dialog']") !== null,
        focus: focusOf(document.activeElement),
      });
    },
    dispose: () => mic.dispose(),
  };
}
