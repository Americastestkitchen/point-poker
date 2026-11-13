// No Jira: previews and local dev type tickets in by hand.
import type { TicketSource } from "./source.ts";

export function noTickets(): TicketSource {
  const off = () => Promise.reject(new Error("Jira isn't configured on the server"));
  return { enabled: false, get: off, find: off };
}
