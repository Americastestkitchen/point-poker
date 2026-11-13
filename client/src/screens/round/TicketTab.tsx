// SLICE: round. The ticket tab (region "ticket", top left; full width on phones): a small paper
// tab with TypeIcon, key and summary (two lines at most) that opens popup "ticket". Hidden when
// there is no ticket.
// Legacy parity: hud.ts renderTicketTab() and #ticket-tab.
// Props: none.
import s from "./TicketTab.module.css";

export function TicketTab() {
  return <div className={s.placeholder}>TicketTab · round</div>;
}
