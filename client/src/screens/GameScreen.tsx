// The in-game HUD's layout: fixed regions along the edges of the screen, so the table, the
// cards and the ticket in the middle stay clear. Each region holds one component;
// popups are kit Dialogs and render over everything. Nothing here needs editing to change
// what a region shows: edit the component in its folder (chrome/, round/, items/, dealer/).
//
//   ┌ ticket ───────────── status ───────────────── top ┐   phones (portrait):  top
//   │                                                   │                       ticket
//   │                   announce                  items │                       status
//   │                (the table, clear)                 │                       (table)
//   │                                                   │                       announce
//   └───────────────────── dock ────────────────────────┘                       items
//                                                                               dock
//
// - top, ticket, items, dock take clicks; status, announce and flash never do, and the gaps
//   between regions let pointer events through to the canvas (drag to look, click a bean).
// - The dock is bounded by the `--dock-max` CSS variable (inherited, so ActionDock can size its
//   cards with it); the toasts are lifted above that height so they never land on the cards.
import { cx } from "../ui/index.ts";
import { useAppState } from "./game.tsx";
import { GameMenu } from "./chrome/GameMenu.tsx";
import { LeaderboardDialog } from "./chrome/LeaderboardDialog.tsx";
import { TopBar } from "./chrome/TopBar.tsx";
import { DealerPanel } from "./dealer/DealerPanel.tsx";
import { TicketPicker } from "./dealer/TicketPicker.tsx";
import { HitFlash } from "./items/HitFlash.tsx";
import { Hotbar } from "./items/Hotbar.tsx";
import { ActionDock } from "./round/ActionDock.tsx";
import { Announcements } from "./round/Announcements.tsx";
import { StatusLine } from "./round/StatusLine.tsx";
import { TicketSheet } from "./round/TicketSheet.tsx";
import { TicketTab } from "./round/TicketTab.tsx";
import s from "./GameScreen.module.css";

export function GameScreen() {
  // the look editor takes the whole screen; the HUD waits underneath, still mounted
  const lookOpen = useAppState((st) => st.ui.lookOpen);
  return (
    <div className={s.screen} data-screen="table" hidden={lookOpen}>
      <div className={cx(s.region, s.ticket, s.interactive)} data-region="ticket">
        <TicketTab />
      </div>
      <div className={cx(s.region, s.status)} data-region="status">
        <StatusLine />
      </div>
      <div className={cx(s.region, s.top, s.interactive)} data-region="top">
        <TopBar />
      </div>
      <div className={cx(s.region, s.announce)} data-region="announce">
        <Announcements />
      </div>
      {/* the hotbar lets the pointer through itself, all but its slots */}
      <div className={cx(s.region, s.items)} data-region="items">
        <Hotbar />
      </div>
      <div className={cx(s.region, s.dock, s.interactive)} data-region="dock">
        <ActionDock />
      </div>
      <div className={cx(s.region, s.flash)} data-region="flash">
        <HitFlash />
      </div>

      {/* popups: kit Dialogs, one open at a time (store.ui.popup) */}
      {/* Options and How to play live in GameRoot: the title menu opens them too */}
      <GameMenu />
      <LeaderboardDialog />
      <TicketSheet />
      <DealerPanel />
      <TicketPicker />
    </div>
  );
}
