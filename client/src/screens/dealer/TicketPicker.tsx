// The dealer's ticket picker (popup "picker"): a Jira link or key (a pasted one
// deals at once), "Or pick from this sprint", the lined-up tickets, "No Jira ticket? Type it
// in", who's at the table with the invite link, and "I play a card too".
// Loads go through useGame().ticketLoad: while one runs the form waits with a spinner; a failure
// opens this popup with the reason in the form (ticketLoad already bonked; no toast here).
// It opens by itself once per stretch without a ticket and closes when one is dealt (picker.ts
// pickerCue), and waits its turn if another popup or the look editor is open. It's always dismissable, even with no ticket: the dock's
// "＋ Add a Jira ticket" opens it again, and the Esc game menu stays reachable.
// Dealer only: it follows the role. The decisions live in picker.ts.
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { TableView } from "../../../../shared/protocol.ts";
import {
  Button,
  cx,
  Dialog,
  ScrollArea,
  Spinner,
  TextField,
  Toggle,
  useFocusable,
  useRoving,
  useUi,
} from "../../ui/index.ts";
import { useAppState, useGame, useMe, usePopup, useRoom, useTicketLoad } from "../game.tsx";
import { useViewChanges } from "../moments.ts";
import { PlayerDot } from "../parts/PlayerDot.tsx";
import {
  jiraSubmit,
  manualSubmit,
  pasteSubmits,
  peopleLine,
  pickerCue,
  pickerErrors,
  pickerSections,
  queueRows,
  type PickerCue,
  type QueueRow,
} from "./picker.ts";
import { Section } from "./Section.tsx";
import s from "./TicketPicker.module.css";

export function TicketPicker() {
  const { store, ticketLoad } = useGame();
  const popup = usePopup("picker");
  const isDealer = useMe()?.isDealer ?? false;
  const hasTicket = useAppState((st) => !!st.room?.ticket);

  // opening and closing by itself (see pickerCue)
  const armed = useRef(true);
  const cue = (c: PickerCue) => {
    const next = pickerCue(armed.current, c);
    armed.current = next.armed;
    if (next.popup === "open") store.popupOpened("picker");
    else if (next.popup === "close") store.popupClosed("picker");
  };
  useViewChanges((c) => {
    if (c.t === "ticketChanged") cue(c);
  });
  // it waits its turn: never over the look editor, never replacing a popup you're reading
  const free = useAppState((st) => st.ui.popup === null && !st.ui.lookOpen);
  useEffect(() => {
    if (free) cue({ t: "seen", isDealer, hasTicket });
  }, [isDealer, hasTicket, free]);

  // closed: a failure it showed is old news next time
  useEffect(() => {
    if (!popup.open) ticketLoad.clear();
  }, [ticketLoad, popup.open]);
  // the role moved away while it was open: let it go, so Esc and the other popups work again
  useEffect(() => {
    if (popup.open && !isDealer) store.popupClosed("picker");
  }, [store, popup.open, isDealer]);

  if (!isDealer) return null;
  return (
    <Dialog open={popup.open} onClose={popup.close} title="What are we estimating?">
      <PickerBody />
    </Dialog>
  );
}

// a phone in portrait has no room for the whole placeholder next to "Deal it"
const NARROW = "(max-width: 480px)";
const subscribeNarrow = (onChange: () => void) => {
  const query = matchMedia(NARROW);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};
const isNarrow = () => matchMedia(NARROW).matches;

/** Mounted only while the picker is open: its drafts and typo message start fresh each time. */
function PickerBody() {
  const { actions, dealerDo, ticketLoad, invite } = useGame();
  const room = useRoom();
  const load = useTicketLoad();
  const [jiraDraft, setJiraDraft] = useState("");
  const [invalid, setInvalid] = useState<string | null>(null);
  const [manualDraft, setManualDraft] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const jiraField = useRef<HTMLInputElement>(null);
  const manualField = useRef<HTMLInputElement>(null);
  const busy = useRef<HTMLDivElement>(null);
  const loading = load.status === "loading";
  const jira = room?.jiraEnabled ?? false;
  const narrow = useSyncExternalStore(subscribeNarrow, isNarrow);

  // A field that's waiting gets disabled, which drops the focus: hold it on the spinner, then
  // hand it back to the field (with the reason, if it failed) so Tab and Enter carry on.
  useEffect(() => {
    // (a just-disabled field may still count as focused until the browser notices)
    const lost = () => {
      const el = document.activeElement;
      return !el || el === document.body || el === busy.current || el.matches(":disabled");
    };
    if (loading) {
      if (lost()) busy.current?.focus({ preventScroll: true });
    } else if (lost()) {
      (jira ? jiraField : manualField).current?.focus({ preventScroll: true });
    }
  }, [loading, jira]);

  if (!room) return null;
  const sections = pickerSections(room);
  const errors = pickerErrors({ jira: sections.jira, invalid, load });
  const manualShown = sections.manual === "always" || manualOpen;

  const edited = () => {
    setInvalid(null);
    ticketLoad.clear();
  };
  const submitJira = (value: string) => {
    if (loading) return;
    const r = jiraSubmit(value);
    if (r.t === "empty") return jiraField.current?.focus();
    if (r.t === "invalid") return setInvalid(r.error);
    setInvalid(null);
    ticketLoad.run(actions.dealer.load(r.ref), r.text);
  };
  const submitManual = () => {
    const summary = manualSubmit(manualDraft);
    if (!summary || loading) return;
    dealerDo(actions.dealer.typeIn(summary));
    setManualDraft("");
  };

  const status = loading && (
    <div ref={busy} tabIndex={-1} className={s.busy} aria-live="polite">
      <Spinner label={load.text} />
    </div>
  );

  return (
    <div className={s.body}>
      {sections.jira && (
        <div className={s.jira}>
          <TextField
            ref={jiraField}
            label="Jira link or key"
            hideLabel
            size="lg"
            autoFocus
            placeholder={narrow ? "Jira link or key" : "Paste a Jira link or key, like SD-1234"}
            value={jiraDraft}
            disabled={loading}
            error={errors.field ?? undefined}
            hint={
              <>
                Tip: paste an <b className={s.em}>epic</b> to line up all of its tickets.
              </>
            }
            enterKeyHint="go"
            onChange={(v) => {
              setJiraDraft(v);
              edited();
            }}
            onPasted={(v) => {
              if (pasteSubmits(v)) submitJira(v);
            }}
            onSubmit={submitJira}
            trailing={
              <Button variant="primary" disabled={loading} onPress={() => submitJira(jiraDraft)}>
                Deal it
              </Button>
            }
          />
          {status}
          <Button
            variant="ghost"
            className={s.sprint}
            disabled={loading}
            onPress={() => ticketLoad.run(actions.dealer.loadSprint(), "Loading this sprint's tickets…")}
          >
            📋 Or pick from this sprint
          </Button>
        </div>
      )}
      {!sections.jira && status}
      {errors.form && (
        <p className={s.formError} role="alert">
          {errors.form}
        </p>
      )}

      <Queue
        room={room}
        disabled={loading}
        onPick={(key) => ticketLoad.run(actions.dealer.load(key), `Fetching ${key}…`)}
      />

      <div className={s.manual} data-open={manualShown || undefined}>
        {sections.manual === "collapsible" ? (
          <Disclosure open={manualOpen} onToggle={() => setManualOpen(!manualOpen)}>
            No Jira ticket? Type it in
          </Disclosure>
        ) : (
          <p className={s.manualTitle}>Type in what you're estimating</p>
        )}
        {manualShown && (
          <TextField
            ref={manualField}
            label="What are we estimating?"
            hideLabel
            autoFocus
            placeholder="What are we estimating?"
            value={manualDraft}
            disabled={loading}
            maxLength={300}
            autoCapitalize="sentences"
            enterKeyHint="done"
            onChange={setManualDraft}
            onSubmit={submitManual}
            trailing={
              <Button variant={sections.jira ? "default" : "primary"} disabled={loading} onPress={submitManual}>
                Deal
              </Button>
            }
          />
        )}
      </div>

      <Footer room={room} onInvite={invite} />
    </div>
  );
}

/** "No Jira ticket? Type it in", opening the typed-in ticket form under it. */
function Disclosure({ open, onToggle, children }: { open: boolean; onToggle: () => void; children: string }) {
  const focus = useFocusable();
  return (
    <button type="button" className={s.disclosure} aria-expanded={open} {...focus} onClick={onToggle}>
      <span>{children}</span>
      <span className={s.chevron} aria-hidden>
        ▾
      </span>
    </button>
  );
}

/** The lined-up tickets: ↑/↓ move, Enter or a tap deals one. */
function Queue({ room, disabled, onPick }: { room: TableView; disabled: boolean; onPick: (key: string) => void }) {
  const queue = queueRows(room);
  const roving = useRoving(queue?.rows.length ?? 0, { disabled: () => disabled });
  if (!queue) return null;
  return (
    <Section title={queue.title}>
      <ScrollArea className={s.queue}>
        <div role="list" aria-label={queue.title} className={s.rows} onKeyDown={roving.onKeyDown}>
          {queue.rows.map((r, i) => (
            <QueueItem key={r.key} row={r} roving={roving.item(i)} disabled={disabled} onPick={onPick} />
          ))}
        </div>
      </ScrollArea>
    </Section>
  );
}

function QueueItem({
  row,
  roving,
  disabled,
  onPick,
}: {
  row: QueueRow;
  roving: ReturnType<ReturnType<typeof useRoving>["item"]>;
  disabled: boolean;
  onPick: (key: string) => void;
}) {
  const { sounds } = useUi();
  const focus = useFocusable(disabled);
  return (
    <div role="listitem" className={s.rowWrap}>
      <button
        type="button"
        {...roving}
        {...focus}
        disabled={disabled}
        className={cx(s.row, row.played && s.played, row.current && s.current)}
        aria-current={row.current || undefined}
        aria-label={`${row.key}: ${row.summary}${row.note ? ` (${row.note})` : ""}${row.current ? ", on the table now" : ""}`}
        onClick={() => {
          sounds.confirm();
          onPick(row.key);
        }}
      >
        <span className={s.key}>{row.key}</span>
        <span className={s.summary}>{row.summary}</span>
        {row.note && <span className={s.note}>{row.note}</span>}
      </button>
    </div>
  );
}

/** Who's here, the invite link (the thing to do while nobody is) and "I'll vote too". */
function Footer({ room, onInvite }: { room: TableView; onInvite: () => void }) {
  const { actions, dealerDo } = useGame();
  const people = peopleLine(room.players);
  return (
    <footer className={s.foot}>
      <div className={s.people}>
        <span className={s.dots} aria-hidden={people.nobody || undefined}>
          {people.dots.map((p) => (
            <PlayerDot key={p.id} player={p} filled={p.connected} />
          ))}
        </span>
        <span className={s.count}>{people.text}</span>
        <Button variant={people.nobody ? "primary" : "default"} shape="pill" className={s.invite} onPress={onInvite}>
          🔗 Copy invite link
        </Button>
      </div>
      <Toggle
        label="🃏 I play a card too"
        checked={room.settings.dealerPlays}
        onChange={(on) => dealerDo(actions.dealer.setPlays(on))}
      />
    </footer>
  );
}
