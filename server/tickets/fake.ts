// An in-memory ticket source for tests.
import type { Ticket, TicketSummary } from "../../shared/protocol.ts";
import { parseIssueKey } from "../../shared/rules.ts";
import type { TicketQuery, TicketSource } from "./source.ts";

export interface FakeTicketsOptions {
  /** Epic key → its children's keys. */
  children?: Record<string, string[]>;
  /** What "current & upcoming sprints" returns. */
  upcoming?: string[];
  /** Hold a load until this resolves, to test slow responses. */
  wait?: (key: string) => Promise<void>;
}

export function ticket(key: string, extra: Partial<Ticket> = {}): Ticket {
  return {
    key,
    summary: `Summary of ${key}`,
    description: "",
    type: "Story",
    status: "To Do",
    priority: "",
    assignee: "Unassigned",
    reporter: "",
    labels: [],
    currentPoints: null,
    url: `https://jira.example/browse/${key}`,
    adf: null,
    statusCategory: "new",
    parent: null,
    ...extra,
  };
}

export function fakeTickets(tickets: Ticket[], opts: FakeTicketsOptions = {}): TicketSource {
  const byKey = new Map(tickets.map((t) => [t.key, t]));
  const summary = (key: string): TicketSummary => {
    const t = byKey.get(key);
    if (!t) throw new Error(`fakeTickets: no ticket ${key} to list`);
    return { key, summary: t.summary, status: t.status, points: t.currentPoints };
  };
  return {
    enabled: true,
    async get(ref) {
      const key = parseIssueKey(ref) ?? ref;
      await opts.wait?.(key);
      const t = byKey.get(key);
      if (!t) throw new Error("Ticket not found (or no access)");
      return t;
    },
    async find(q: TicketQuery) {
      if (q.kind === "epic") {
        await opts.wait?.(q.key);
        return { label: `Epic ${q.key}`, tickets: (opts.children?.[q.key] ?? []).map(summary) };
      }
      return { label: "Current & upcoming sprints", tickets: (opts.upcoming ?? []).map(summary) };
    },
  };
}
