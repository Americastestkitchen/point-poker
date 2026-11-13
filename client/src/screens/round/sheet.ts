// The ticket sheet's decisions: when it opens and closes by itself, and what its header and
// details say. Pure; TicketSheet.tsx draws it.
import type { Epic, Ticket, TableView } from "../../../../shared/protocol.ts";
import type { ViewChange } from "../../app/events.ts";
import { safeUrl } from "../text.ts";

/** How long after "New ticket" the sheet slides in, so the announcement is read first. */
export const OPEN_AFTER_DEAL_MS = 900;

export type SheetMove = "open" | "openSoon" | "close" | null;

/**
 * What the sheet does about a change in the view: you arrive mid-vote (open it), a round is
 * dealt (open it once the announcement has had a moment), the cards go up (put it away).
 */
export function sheetMove(change: ViewChange, room: TableView): SheetMove {
  switch (change.t) {
    case "synced":
      return room.ticket && room.phase === "voting" ? "open" : null;
    case "dealt":
      return room.ticket ? "openSoon" : null;
    case "revealed":
      return "close";
    default:
      return null;
  }
}

/** One step of the breadcrumbs: Projects / SD / ⚡ SD-10 / ▮ SD-12. */
export interface Crumb {
  text: string;
  /** Shows that issue type's icon before the text. */
  type?: string;
  href?: string;
}

export function crumbs(ticket: Ticket, epic: Epic | null): Crumb[] {
  const project = ticket.key.replace(/-[\s\S]*$/, "");
  const out: Crumb[] = [{ text: "Projects" }, { text: project }];
  const parent = ticket.parent ?? epic;
  if (parent) out.push({ text: parent.key, type: "epic" });
  const href = safeUrl(ticket.url);
  out.push({ text: ticket.key, type: ticket.type || "task", ...(href ? { href } : {}) });
  return out;
}

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** "Ada Lovelace" → "AL"; at most two letters (an emoji or accented letter counts as one). */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .flatMap((w) => Array.from(graphemes.segment(w), (g) => g.segment).slice(0, 1))
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** The status lozenge's colour: Jira's category, "new" when it doesn't say. */
export const statusTone = (t: Ticket): "new" | "indeterminate" | "done" => t.statusCategory || "new";

/** Who it's assigned to; "" for nobody (Jira says "Unassigned"). */
export const assignee = (t: Ticket) => (t.assignee && t.assignee !== "Unassigned" ? t.assignee : "");
