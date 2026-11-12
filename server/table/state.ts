// Everything a table remembers, as plain JSON. Sockets live in transport/,
// so saving a table is JSON.stringify and loading it is a schema check.
import { z } from "zod";
import { DECKS } from "../../shared/catalog/decks.ts";
import { BODIES, Card, Epic, HATS, Phase, RoundResult, Ticket, TicketSummary } from "../../shared/protocol.ts";

export const PlayerState = z.object({
  id: z.string(),
  /** Secret seat token: the browser keeps it so the player can reconnect. */
  token: z.string(),
  name: z.string(),
  color: z.string(),
  hat: z.enum(HATS),
  body: z.enum(BODIES),
  /** 0..MAX_PLAYERS-1; the dealer sits at -1. */
  seat: z.number(),
  vote: z.number().nullable(),
  chips: z.number(),
  /** What the last settle paid this player, so a re-settle can take it back. */
  lastWin: z.number(),
});
export type PlayerState = z.infer<typeof PlayerState>;

export const TableSettings = z.object({
  deck: z.array(Card),
  dealerPlays: z.boolean(),
  environment: z.string(),
});
export type TableSettings = z.infer<typeof TableSettings>;

export const TableState = z.object({
  code: z.string(),
  /** Secret that makes whoever presents it the dealer. */
  dealerKey: z.string(),
  dealerId: z.string().nullable(),
  players: z.array(PlayerState),
  phase: Phase,
  round: z.number(),
  ticket: Ticket.nullable(),
  pot: z.number(),
  finalPoints: z.number().nullable(),
  winners: z.array(z.string()),
  share: z.number(),
  houseWon: z.boolean(),
  history: z.array(RoundResult),
  skipped: z.array(z.string()),
  /** Tokens of players the dealer kicked; they can't rejoin this table. */
  banned: z.array(z.string()),
  settings: TableSettings,
  epic: Epic.nullable(),
  queue: z.array(TicketSummary),
  queueLabel: z.string(),
  lastActive: z.number(),
});
export type TableState = z.infer<typeof TableState>;

// TableState must stay plain JSON (no Set, Map, class or function), or saving
// would silently drop data. This line stops compiling if that ever changes.
type Json = string | number | boolean | null | undefined | readonly Json[] | { readonly [key: string]: Json };
export const jsonSafe = (s: TableState): Json => s;

export function newTableState(code: string, dealerKey: string, now: number): TableState {
  return {
    code, dealerKey, dealerId: null, players: [], phase: "waiting", round: 0, ticket: null,
    pot: 0, finalPoints: null, winners: [], share: 0, houseWon: false, history: [], skipped: [], banned: [],
    settings: { deck: DECKS.classic.cards, dealerPlays: false, environment: "basement" },
    epic: null, queue: [], queueLabel: "", lastActive: now,
  };
}
