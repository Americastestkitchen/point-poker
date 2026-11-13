// The game UI's root. It owns what happens once for the whole screen: the one toast adapter
// (event-stream toasts, joins, leaves, being removed), opening the ticket when the 3D paper is
// clicked, the window title, and Esc opening the game menu. Everything else lives in the
// components GameScreen lays out.
import { useEffect, useSyncExternalStore } from "react";
import { useBack } from "../ui/index.ts";
import { useAppState, useGame } from "./game.tsx";
import { focusOf, menuKeyAllowed } from "./keys.ts";
import { useGameEvents, useViewChanges } from "./moments.ts";
import { connectionNotice, eventNotice, viewNotice, type Notice } from "./notices.ts";
import { CopyFallback } from "./parts/CopyFallback.tsx";
import { GameScreen } from "./GameScreen.tsx";

export function GameRoot() {
  useNotices();
  useOpenTicket();
  useWindowTitle();
  useMenuKey();
  return (
    <>
      <GameScreen />
      {/* after the popups, so it opens over whichever one asked to copy */}
      <CopyFallback />
    </>
  );
}

/** The one place toasts come from for what happened (components show their own results). */
function useNotices() {
  const { store, toasts, audio } = useGame();
  const show = (n: Notice | null) => {
    if (!n) return;
    toasts.show(n.text, { tone: n.tone });
    if (n.bonk) audio.bonk();
  };
  useGameEvents((e) => show(eventNotice(e)));
  useViewChanges((c, s) => show(viewNotice(c, s.me?.id)));
  useEffect(() => store.subscribe((s, prev) => {
    const n = connectionNotice(prev.connection, s.connection);
    if (n) toasts.show(n.text, { tone: n.tone });
  }), [store, toasts]);
}

/** Clicking the ticket on the table opens it full size (TicketSheet draws the popup). */
function useOpenTicket() {
  const { store } = useGame();
  useGameEvents((e, s) => {
    if (e.t === "openTicket" && s.room?.ticket) store.popupOpened("ticket");
  });
}

function useWindowTitle() {
  const key = useAppState((s) => s.room?.ticket?.key);
  useEffect(() => {
    document.title = `${key ? `${key} · ` : ""}Point Poker`;
  }, [key]);
}

/** Where focus is, kept current for render (focus changes don't re-render on their own). */
const subscribeFocus = (onChange: () => void) => {
  document.addEventListener("focusin", onChange);
  document.addEventListener("focusout", onChange);
  return () => {
    document.removeEventListener("focusin", onChange);
    document.removeEventListener("focusout", onChange);
  };
};
const currentFocus = () => focusOf(document.activeElement);

/**
 * Esc at the table opens the game menu: the bottom of the kit's Esc stack (depth 0), so any
 * popup takes Esc first. It stands aside while a popup or the look editor is open, or a text
 * field is focused (it keeps its own Esc).
 */
function useMenuKey() {
  const { store } = useGame();
  const focus = useSyncExternalStore(subscribeFocus, currentFocus);
  const screen = useAppState((s) => s.screen);
  const popup = useAppState((s) => s.ui.popup);
  const lookOpen = useAppState((s) => s.ui.lookOpen);
  useBack(() => store.popupOpened("menu"), menuKeyAllowed({ screen, popup, lookOpen, focus }), 0);
}
