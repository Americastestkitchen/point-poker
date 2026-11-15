// The ticket tab (region "ticket", top left; full width on phones): a scrap of paper with the
// type icon, key and summary (two lines at most) that opens the whole ticket (popup "ticket").
// Hidden when there is no ticket. In the lobby the invite sits here instead: the table's code
// (press it to copy it) and the invite link, for everyone, until the first ticket takes the spot.
import { Button, useFocusable } from "../../ui/index.ts";
import { useAppState, useGame, usePopup } from "../game.tsx";
import { TypeIcon } from "../parts/TypeIcon.tsx";
import s from "./TicketTab.module.css";

export function TicketTab() {
  const ticket = useAppState((st) => st.room?.ticket ?? null);
  const popup = usePopup("ticket");
  const focus = useFocusable();
  const lobby = useAppState((st) => (st.room && !st.room.started ? st.room.code : null));
  if (lobby) return <Invite code={lobby} />;
  if (!ticket) return null;
  return (
    <button
      type="button"
      {...focus}
      className={s.tab}
      onClick={popup.show}
      aria-haspopup="dialog"
      aria-label={`Read the ticket: ${ticket.key}, ${ticket.summary}`}
    >
      <TypeIcon type={ticket.type || "task"} />
      <span className={s.key}>{ticket.key}</span>
      <span className={s.summary} title={ticket.summary}>
        {ticket.summary}
      </span>
      <span className={s.open} aria-hidden>
        Read ▸
      </span>
    </button>
  );
}

/** The lobby's invite: the code in big letters (press to copy just that) and the link to send. */
function Invite({ code }: { code: string }) {
  const { invite, copy } = useGame();
  const focus = useFocusable();
  return (
    <section className={s.invite} aria-label="Invite">
      <button
        type="button"
        {...focus}
        className={s.code}
        title="Copy the table code"
        aria-label={`Table code ${code.split("").join(" ")}: copy it`}
        onClick={() =>
          void copy.copy(code, { done: `📋 Table code ${code} copied.`, title: "Tell your team this code" })
        }
      >
        <span className={s.eyebrow}>Table</span>
        <strong className={s.letters}>{code}</strong>
      </button>
      <Button variant="primary" shape="pill" size="md" onPress={invite}>
        🔗 Copy invite link
      </Button>
    </section>
  );
}
