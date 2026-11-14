// The game UI's root. Before you sit down it shows the title screens; at the table, the HUD
// (GameScreen) and the look editor when it's open. It owns what happens once for the whole
// screen: the one toast adapter (event-stream toasts, joins, leaves, being removed, someone pointing at you or
// answering your emote), opening
// the ticket when the 3D paper is clicked, the window title (and the dealer's "all in" chime),
// and Esc opening the game menu.
// Options and How to play open from the title menu and the game menu alike.
import { useEffect, useRef, useSyncExternalStore } from "react";
import { useBack } from "../ui/index.ts";
import { HowToPlayDialog } from "./chrome/HowToPlayDialog.tsx";
import { OptionsDialog } from "./chrome/OptionsDialog.tsx";
import { useAppState, useGame } from "./game.tsx";
import { focusOf, menuKeyAllowed } from "./keys.ts";
import { useGameEvents, useViewChanges } from "./moments.ts";
import { connectionNotice, eventNotice, forYouNotice, viewNotice, type Notice } from "./notices.ts";
import { CopyFallback } from "./parts/CopyFallback.tsx";
import { chimeFor, tabTitle } from "./tab.ts";
import { GameScreen } from "./GameScreen.tsx";
import { LookEditor } from "./character/LookEditor.tsx";
import type { Title } from "./title/runner.ts";
import { TitleScreen } from "./title/TitleScreen.tsx";

export function GameRoot({ title }: { title: Title }) {
  useNotices();
  useOpenTicket();
  useWindowTitle();
  useAllInChime();
  useMenuKey();
  const atTable = useAppState((st) => st.screen === "table");
  return (
    <>
      {atTable ? <GameScreen /> : <TitleScreen title={title} />}
      <LookEditor />
      <OptionsDialog />
      <HowToPlayDialog />
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
  useGameEvents((e, s) => {
    show(eventNotice(e));
    show(forYouNotice(e, s.room?.players ?? [], s.me?.id));
  });
  useViewChanges((c, s) => show(viewNotice(c, s.me?.id)));
  useEffect(
    () =>
      store.subscribe((s, prev) => {
        const n = connectionNotice(prev.connection, s.connection);
        if (n) toasts.show(n.text, { tone: n.tone });
      }),
    [store, toasts],
  );
}

/** Clicking the ticket on the table opens it full size (TicketSheet draws the popup). */
function useOpenTicket() {
  const { store } = useGame();
  useGameEvents((e, s) => {
    if (e.t === "openTicket" && s.room?.ticket) store.popupOpened("ticket");
  });
}

function useWindowTitle() {
  const title = useAppState((s) => tabTitle(s.room, s.me?.id));
  useEffect(() => {
    document.title = title;
  }, [title]);
}

/** The dealer hears when the last card goes down, even from another window (mute silences it). */
function useAllInChime() {
  const { audio } = useGame();
  const chimed = useRef<string | null>(null);
  useViewChanges((c, s) => {
    const round = s.room && chimeFor(c, s.room, s.me?.id, chimed.current);
    if (!round) return;
    chimed.current = round;
    audio.chime();
  });
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
