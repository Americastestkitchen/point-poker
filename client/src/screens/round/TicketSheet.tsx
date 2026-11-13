// SLICE: round. The whole ticket, read like a Jira page (popup "ticket"). Use Dialog
// variant="paper" width="xl" with the sheet tokens (--pp-color-sheet-*, --pp-color-status-*,
// --pp-color-note-*, --pp-font-sheet, --pp-shadow-sheet) and TypeIcon.
// The screen root already opens it when the 3D paper is clicked (openTicket, only when there
// is a ticket); everything else about when it opens is this slice's, via useViewChanges:
// "synced" while voting opens it, "dealt" opens it about 0.9 s after the announcement, and
// "revealed" closes it; audio.slide() as it opens.
// Legacy parity: hud.ts fillSheet / openSheet / closeSheet: breadcrumbs (project, epic or
// parent, the key linking to Jira), the summary as title, the description, the status
// lozenge, details (assignee, reporter, priority, labels, story points) and "Open in Jira ↗"
// (ButtonLink). The description: client/src/adf.ts renderAdf() builds DOM; mount it through a
// ref or replace it with React. This slice decides adf.ts's future; its old .adf rules went
// with style.css.
// Props: none.
import { Dialog } from "../../ui/index.ts";
import { usePopup } from "../game.tsx";
import s from "./TicketSheet.module.css";

export function TicketSheet() {
  const popup = usePopup("ticket");
  return (
    <Dialog open={popup.open} onClose={popup.close} title="Ticket" variant="paper" width="xl">
      <p className={s.placeholder}>TicketSheet · round</p>
    </Dialog>
  );
}
