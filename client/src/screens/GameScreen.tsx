// The in-game HUD's layout: fixed regions along the edges of the screen, so the table, the
// cards and the ticket in the middle stay clear. Each region holds one component;
// popups are kit Dialogs and render over everything. Nothing here needs editing to change
// what a region shows: edit the component in its folder (chrome/, round/, dealer/).
//
//   ┌ ticket ───────────── status ───────────────── top ┐   phones (portrait):  top
//   │                                                   │                       ticket
//   │                   announce                        │                       status
//   │                (the table, clear)                 │                       (table)
//   │                                                   │                       announce
//   └───────────────────── dock ────────────────────────┘                       dock
//
// - top, ticket, dock take clicks; status, announce and flash never do, and the gaps between
//   regions let pointer events through to the canvas (drag to look, click a bean).
// - The dock is bounded by the `--dock-max` CSS variable (inherited, so ActionDock can size its
//   cards with it); the toasts are lifted above that height so they never land on the cards.
import { cx } from "../ui/index.ts";
import { useAppState } from "./game.tsx";
import { GameMenu } from "./chrome/GameMenu.tsx";
import { HowToPlayDialog } from "./chrome/HowToPlayDialog.tsx";
import { LeaderboardDialog } from "./chrome/LeaderboardDialog.tsx";
import { OptionsDialog } from "./chrome/OptionsDialog.tsx";
import { TopBar } from "./chrome/TopBar.tsx";
import { DealerPanel } from "./dealer/DealerPanel.tsx";
import { TicketPicker } from "./dealer/TicketPicker.tsx";
import { ActionDock } from "./round/ActionDock.tsx";
import { Announcements } from "./round/Announcements.tsx";
import { BonkFlash } from "./round/BonkFlash.tsx";
import { StatusLine } from "./round/StatusLine.tsx";
import { TicketSheet } from "./round/TicketSheet.tsx";
import { TicketTab } from "./round/TicketTab.tsx";
import s from "./GameScreen.module.css";

export function GameScreen() {
  const atTable = useAppState((st) => st.screen === "table");
  if (!atTable) return null;
  return (
    <div className={s.screen} data-screen="table">
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
      <div className={cx(s.region, s.dock, s.interactive)} data-region="dock">
        <ActionDock />
      </div>
      <div className={cx(s.region, s.flash)} data-region="flash">
        <BonkFlash />
      </div>

      {/* popups: kit Dialogs, one open at a time (store.ui.popup) */}
      <GameMenu />
      <OptionsDialog />
      <HowToPlayDialog />
      <LeaderboardDialog />
      <TicketSheet />
      <DealerPanel />
      <TicketPicker />
    </div>
  );
}
