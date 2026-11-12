// Where tickets come from. The table only ever talks to this interface.
import type { Ticket, TicketSummary } from "../../shared/protocol.ts";

export type TicketQuery =
  | { kind: "epic"; key: string }
  /** Current and upcoming sprints; `project` falls back to the source's default. */
  | { kind: "upcoming"; project?: string };

export interface TicketSource {
  /** False when there's no Jira to talk to (previews, local dev without a token). */
  readonly enabled: boolean;
  get(ref: string): Promise<Ticket>;
  find(q: TicketQuery): Promise<{ label: string; tickets: TicketSummary[] }>;
}
