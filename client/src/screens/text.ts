// Small words-and-glyphs helpers every screen needs. Pure.

/** "Ann", "Ann & Bob", "Ann, Bob & Cat". */
export function names(list: readonly string[]): string {
  const last = list.at(-1);
  return list.length <= 1 || last === undefined ? list.join("") : `${list.slice(0, -1).join(", ")} & ${last}`;
}

/** The kinds of ticket with their own icon; everything else is `other`. */
export type TicketKind = "bug" | "story" | "epic" | "task" | "other";

const KINDS: Record<string, TicketKind> = { bug: "bug", story: "story", epic: "epic", task: "task", subtask: "task", "sub-task": "task" };
const GLYPHS: Record<TicketKind, string> = { bug: "●", story: "▮", epic: "⚡", task: "✓", other: "◆" };

/** The icon for a Jira issue type ("Bug", "Sub-task", "" for a typed-in ticket). */
export function ticketKind(type: string): { kind: TicketKind; glyph: string } {
  const kind = KINDS[type.trim().toLowerCase()] ?? (type.trim() ? "other" : "task");
  return { kind, glyph: GLYPHS[kind] };
}
