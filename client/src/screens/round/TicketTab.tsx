// The ticket tab (region "ticket", top left; full width on phones): a scrap of paper with the
// type icon, key and summary (two lines at most) that opens the whole ticket (popup "ticket").
// Hidden when there is no ticket.
import { useFocusable } from "../../ui/index.ts";
import { useAppState, usePopup } from "../game.tsx";
import { TypeIcon } from "../parts/TypeIcon.tsx";
import s from "./TicketTab.module.css";

export function TicketTab() {
  const ticket = useAppState((st) => st.room?.ticket ?? null);
  const popup = usePopup("ticket");
  const focus = useFocusable();
  if (!ticket) return null;
  return (
    <button type="button" {...focus} className={s.tab} onClick={popup.show} aria-haspopup="dialog"
      aria-label={`Read the ticket: ${ticket.key}, ${ticket.summary}`}>
      <TypeIcon type={ticket.type || "task"} />
      <span className={s.key}>{ticket.key}</span>
      <span className={s.summary} title={ticket.summary}>{ticket.summary}</span>
      <span className={s.open} aria-hidden>Read ▸</span>
    </button>
  );
}
