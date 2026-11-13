// SLICE: dealer. The dealer's control panel (popup "dealer"), opened from the top bar.
// Legacy parity: hud.ts renderDealer(): "This round": Restart vote (dealerDo(actions.dealer.deal())),
// Skip ticket (with a next ticket queued: ticketLoad.run(actions.dealer.skip(), `Skipping to KEY…`),
// else dealerDo(skip)), Cancel round (behind a ConfirmDialog, tone "danger"), Pick a ticket
// (popup "picker"); the players (PlayerDot; away / ✓ voted / thinking…; Kick behind a
// ConfirmDialog); "I play a card too" (Toggle → dealerDo(actions.dealer.setPlays(on))).
// Confirms are local dialogs inside this one, not popups.
// Props: none.
import { Dialog } from "../../ui/index.ts";
import { usePopup } from "../game.tsx";
import s from "./DealerPanel.module.css";

export function DealerPanel() {
  const popup = usePopup("dealer");
  return (
    <Dialog open={popup.open} onClose={popup.close} title="Dealer controls">
      <p className={s.placeholder}>DealerPanel · dealer</p>
    </Dialog>
  );
}
