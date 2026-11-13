// The ticket picker's decisions, from the table view and what the dealer typed. Pure, so it's
// tested without a browser; TicketPicker.tsx only draws them and wires the presses.
import type { PublicPlayer, TableView } from "../../../../shared/protocol.ts";
import { parseIssueKey } from "../../../../shared/rules.ts";
import type { TicketLoadState } from "../ticket-load.ts";

export const BAD_KEY = "Paste a Jira link, or a key like SD-1234";
/** How many people the footer shows as dots before it only counts them. */
export const MAX_DOTS = 8;

// ---------------------------------------------------------------- sections

export interface PickerSections {
  /** The Jira field, the epic tip and "Or pick from this sprint". */
  jira: boolean;
  /**
   * Typing a ticket in: `collapsible` behind "No Jira ticket? Type it in" when there's Jira,
   * `always` open (it's the only way in) when there isn't.
   */
  manual: "collapsible" | "always";
}

export function pickerSections(room: Pick<TableView, "jiraEnabled">): PickerSections {
  return { jira: room.jiraEnabled, manual: room.jiraEnabled ? "collapsible" : "always" };
}

// ---------------------------------------------------------------- the queue

export interface QueueRow {
  key: string;
  summary: string;
  /** The right-hand note: "✓ done", "skipped", "3 pts" or "". */
  note: string;
  /** Done or skipped this session: drawn dimmed, still pickable to play it again. */
  played: boolean;
  /** On the table right now. */
  current: boolean;
}

type QueueView = Pick<TableView, "queue" | "queueLabel" | "history" | "skipped" | "ticket">;

/** The lined-up tickets (an epic's, or the sprint's), or null when nothing is lined up. */
export function queueRows(room: QueueView): { title: string; rows: QueueRow[] } | null {
  if (room.queue.length === 0) return null;
  const done = new Set(room.history.map((h) => h.key));
  const skipped = new Set(room.skipped);
  const rows = room.queue.map((q): QueueRow => ({
    key: q.key,
    summary: q.summary,
    note: done.has(q.key) ? "✓ done" : skipped.has(q.key) ? "skipped" : q.points !== null ? `${q.points} pts` : "",
    played: done.has(q.key) || skipped.has(q.key),
    current: q.key === room.ticket?.key,
  }));
  const label = room.queueLabel.trim() || "Lined up";
  return { title: `${label} · tap one to deal it`, rows };
}

// ---------------------------------------------------------------- the forms

export type JiraSubmit =
  /** Nothing typed: put the cursor back in the field. */
  | { t: "empty" }
  | { t: "invalid"; error: string }
  /** Load `ref` (the whole link or key, as typed), saying `text` meanwhile. */
  | { t: "load"; ref: string; text: string };

export function jiraSubmit(input: string): JiraSubmit {
  const ref = input.trim();
  if (!ref) return { t: "empty" };
  const key = parseIssueKey(ref);
  if (!key) return { t: "invalid", error: BAD_KEY };
  return { t: "load", ref, text: `Fetching ${key} from Jira…` };
}

/** A paste that's already a link or key deals straight away; anything else waits for Enter. */
export const pasteSubmits = (value: string) => parseIssueKey(value) !== null;

/** A typed-in ticket's summary, or null when there's nothing to deal. */
export function manualSubmit(input: string): string | null {
  const summary = input.trim();
  return summary ? summary : null;
}

/** Where an error shows: under the Jira field when there is one, else over the whole form. */
export function pickerErrors(o: { jira: boolean; invalid: string | null; load: TicketLoadState }): { field: string | null; form: string | null } {
  const failed = o.load.status === "failed" ? o.load.reason : null;
  if (o.jira) return { field: o.invalid ?? failed, form: null };
  return { field: null, form: failed };
}

// ---------------------------------------------------------------- opening by itself

/**
 * What tells the picker to open or close by itself:
 * - `seen`: the latest view (are you the dealer, is there a ticket on the table);
 * - `ticketChanged`: a ticket was just dealt.
 */
export type PickerCue = { t: "seen"; isDealer: boolean; hasTicket: boolean } | { t: "ticketChanged" };

/**
 * The picker opens by itself once per stretch without a ticket, for the dealer; dealing a
 * ticket closes it and arms it for the next stretch. `armed` starts true. Dismissing it
 * doesn't re-arm it, so it never pops straight back up.
 */
export function pickerCue(armed: boolean, cue: PickerCue): { armed: boolean; popup: "open" | "close" | null } {
  if (cue.t === "ticketChanged") return { armed: true, popup: "close" };
  if (cue.isDealer && !cue.hasTicket && armed) return { armed: false, popup: "open" };
  return { armed, popup: null };
}

// ---------------------------------------------------------------- the footer

export function peopleLine<P extends Pick<PublicPlayer, "isDealer">>(players: readonly P[]): { dots: P[]; text: string; nobody: boolean } {
  const others = players.filter((p) => !p.isDealer);
  return {
    dots: others.slice(0, MAX_DOTS),
    text: others.length ? `${others.length} at the table` : "Nobody's here yet",
    nobody: others.length === 0,
  };
}
