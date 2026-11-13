// SLICE: dealer. The dealer's ticket picker (popup "picker").
// Legacy parity: hud.ts setupPicker / openPicker / closePicker / renderPicker / whileLoading /
// loadFailed / pickerError: a Jira link or key (TextField with onSubmit and onPasted;
// parseIssueKey from shared/rules.ts; "Paste a Jira link, or a key like SD-1234" as a local
// form error), "Or pick from this sprint" (loadSprint), the queue (played / current / points),
// "No Jira ticket? Type it in" (typeIn), who is at the table (PlayerDot), "Copy invite link"
// (useGame().invite(), primary while nobody is here) and "I'll vote too" (Toggle).
// Loads go through useGame().ticketLoad.run(work, text). useTicketLoad() is idle, loading
// (Spinner with its text, form disabled) or failed (show `reason`; ticketLoad.clear() when the
// dealer edits). A failed load anywhere opens this popup by itself.
// To build here: open it by itself for the dealer when the table has no ticket, close it on
// "ticketChanged" (useViewChanges), and make it not dismissable while there is no ticket.
// Props: none.
import { Dialog } from "../../ui/index.ts";
import { usePopup } from "../game.tsx";
import s from "./TicketPicker.module.css";

export function TicketPicker() {
  const popup = usePopup("picker");
  return (
    <Dialog open={popup.open} onClose={popup.close} title="What are we estimating?">
      <p className={s.placeholder}>TicketPicker · dealer</p>
    </Dialog>
  );
}
