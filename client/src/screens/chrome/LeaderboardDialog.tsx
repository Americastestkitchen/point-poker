// SLICE: chrome. The leaderboard (popup "leaderboard"), opened from the coins in the top bar.
// Legacy parity: hud.ts renderBoard(): players by chips (a crown for a leader with chips, you
// highlighted, away players dimmed; the dealer can "remove" an away player with
// dealerDo(actions.dealer.kick(id))), "Rounds played" (house wins / winners via names(), +share),
// and "📋 Copy for Jira": the latest result per ticket as "KEY\tN pts\tSummary" lines through
// useGame().copy.copy(text, { done: "📋 Copied N tickets and their points", title }). Long
// lists scroll in a ScrollArea. PlayerDot for colours.
// Props: none.
import { Dialog } from "../../ui/index.ts";
import { usePopup } from "../game.tsx";
import s from "./LeaderboardDialog.module.css";

export function LeaderboardDialog() {
  const popup = usePopup("leaderboard");
  return (
    <Dialog open={popup.open} onClose={popup.close} title="Leaderboard">
      <p className={s.placeholder}>LeaderboardDialog · chrome</p>
    </Dialog>
  );
}
