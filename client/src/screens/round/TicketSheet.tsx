// The whole ticket, read like a Jira page (popup "ticket"): a paper Dialog with breadcrumbs,
// the summary, the description, the status lozenge, the details and "Open in Jira ↗".
// The screen root opens it when the 3D paper is clicked; this opens it when you arrive mid-vote
// and ~0.9 s after a deal, and puts it away on the reveal (sheet.ts decides). It follows the
// ticket if that changes while it's open, and closes if the ticket goes away.
import { useEffect, useRef, type ReactNode } from "react";
import type { Epic, Ticket } from "../../../../shared/protocol.ts";
import { ButtonLink, cx, Dialog } from "../../ui/index.ts";
import { useGame, usePopup, useRoom } from "../game.tsx";
import { useViewChanges } from "../moments.ts";
import { TypeIcon } from "../parts/TypeIcon.tsx";
import { Adf } from "./Adf.tsx";
import { safeUrl } from "../text.ts";
import { assignee, crumbs, initials, OPEN_AFTER_DEAL_MS, sheetMove, statusTone } from "./sheet.ts";
import s from "./TicketSheet.module.css";

export function TicketSheet() {
  const { store, audio } = useGame();
  const popup = usePopup("ticket");
  const room = useRoom();
  const ticket = room?.ticket ?? null;
  const open = popup.open && ticket !== null;
  const soon = useRef<ReturnType<typeof setTimeout>>(undefined);

  /** Opens it by itself, unless something else is up (a menu, the picker, the look editor). */
  const openIfFree = () => {
    const st = store.getState();
    if (
      st.room?.ticket &&
      st.screen === "table" &&
      !st.ui.lookOpen &&
      (st.ui.popup === null || st.ui.popup === "ticket")
    ) {
      store.popupOpened("ticket");
    }
  };

  useViewChanges((change, st) => {
    if (!st.room) return;
    const move = sheetMove(change, st.room);
    if (move === null) return;
    clearTimeout(soon.current);
    if (move === "open") openIfFree();
    else if (move === "openSoon") soon.current = setTimeout(openIfFree, OPEN_AFTER_DEAL_MS);
    else store.popupClosed("ticket");
  });
  useEffect(() => () => clearTimeout(soon.current), []);

  // the ticket went away (the round was cancelled): nothing left to read
  useEffect(() => {
    if (popup.open && !ticket) store.popupClosed("ticket");
  }, [popup.open, ticket, store]);

  // the paper slides out of the ticket on the table
  useEffect(() => {
    if (open) audio.slide();
  }, [open, audio]);

  return (
    <Dialog
      open={open}
      onClose={popup.close}
      variant="paper"
      width="xl"
      title={ticket ? <Heading ticket={ticket} epic={room?.epic ?? null} /> : ""}
    >
      {ticket && <Sheet ticket={ticket} />}
    </Dialog>
  );
}

function Heading({ ticket, epic }: { ticket: Ticket; epic: Epic | null }) {
  const path = crumbs(ticket, epic);
  return (
    <span className={s.heading}>
      <span className={s.crumbs}>
        {path.map((c, i) => (
          <span key={`${i}:${c.text}`} className={s.crumb}>
            {i > 0 && (
              <i className={s.slash} aria-hidden>
                /
              </i>
            )}
            {c.type !== undefined && <TypeIcon type={c.type} size="sm" />}
            {c.href ? (
              <a className={s.crumbLink} href={c.href} target="_blank" rel="noreferrer">
                {c.text}
              </a>
            ) : (
              c.text
            )}
          </span>
        ))}
      </span>
      <span className={s.summary}>{ticket.summary}</span>
    </span>
  );
}

function Sheet({ ticket }: { ticket: Ticket }) {
  const url = safeUrl(ticket.url);
  const who = assignee(ticket);
  return (
    // focus lands here, so the arrow keys and Page Down scroll the description straight away
    <div className={s.wrap} tabIndex={-1} data-autofocus>
      <div className={s.sheet}>
        <section className={s.main} aria-label="Description">
          <h3 className={s.h}>Description</h3>
          <Adf adf={ticket.adf} fallback={ticket.description} />
        </section>
        <aside className={s.side} aria-label="Details">
          {ticket.status && <span className={cx(s.lozenge, s[statusTone(ticket)])}>{ticket.status}</span>}
          <div className={s.details}>
            <h3 className={s.dh}>Details</h3>
            <dl className={s.fields}>
              <Field label="Assignee">
                <Person name={who} />
              </Field>
              {ticket.reporter && (
                <Field label="Reporter">
                  <Person name={ticket.reporter} />
                </Field>
              )}
              {ticket.priority && <Field label="Priority">{ticket.priority}</Field>}
              <Field label="Labels">
                {ticket.labels.length ? (
                  ticket.labels.map((l) => (
                    <span key={l} className={s.label}>
                      {l}
                    </span>
                  ))
                ) : (
                  <span className={s.muted}>None</span>
                )}
              </Field>
              <Field label="Story points">
                {ticket.currentPoints !== null ? (
                  <span className={s.points}>{ticket.currentPoints}</span>
                ) : (
                  <span className={s.muted}>Not pointed yet</span>
                )}
              </Field>
            </dl>
          </div>
          {url && (
            <ButtonLink href={url} variant="primary" size="md" className={s.jira}>
              Open in Jira ↗
            </ButtonLink>
          )}
        </aside>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={s.field}>
      <dt className={s.fieldLabel}>{label}</dt>
      <dd className={s.fieldValue}>{children}</dd>
    </div>
  );
}

function Person({ name }: { name: string }) {
  if (!name) return <span className={s.muted}>None</span>;
  return (
    <>
      <span className={s.avatar} aria-hidden>
        {initials(name)}
      </span>
      <span className={s.name}>{name}</span>
    </>
  );
}
