// Messages and views shared by the server and the browser client.
// Every message is a Zod schema; the TypeScript types come from the schemas.
import { z } from "zod";
import { EMOTE_IDS } from "./catalog/emotes.ts";
import { DEFAULT_ENVIRONMENT, ENVIRONMENT_IDS } from "./catalog/environments.ts";
import { Look, LookInput } from "./look.ts";

export const Phase = z.enum(["waiting", "voting", "revealed", "settled"]);
export type Phase = z.infer<typeof Phase>;

/** One card in a deck. `points` is null for cards like "?" that don't count. */
export const Card = z.object({ label: z.string(), points: z.number().nullable() });
export type Card = z.infer<typeof Card>;

export const Ticket = z.object({
  key: z.string(),
  summary: z.string(),
  description: z.string(),
  type: z.string(),
  status: z.string(),
  priority: z.string(),
  assignee: z.string(),
  reporter: z.string(),
  labels: z.array(z.string()),
  currentPoints: z.number().nullable(),
  url: z.string(),
  /** Jira's rich description (Atlassian Document Format), rendered client-side. */
  adf: z.json().nullable(),
  statusCategory: z.enum(["new", "indeterminate", "done", ""]),
  parent: z.object({ key: z.string(), summary: z.string() }).nullable(),
});
export type Ticket = z.infer<typeof Ticket>;

export const TicketSummary = z.object({
  key: z.string(),
  summary: z.string(),
  points: z.number().nullable(),
  status: z.string(),
  played: z.boolean().optional(),
});
export type TicketSummary = z.infer<typeof TicketSummary>;

export const Epic = z.object({ key: z.string(), summary: z.string(), url: z.string() });
export type Epic = z.infer<typeof Epic>;

/** The deck and the extra house rules. */
export const TableSettings = z.object({
  deck: z.array(Card),
  dealerPlays: z.boolean(),
  /**
   * Always the Basement, whichever room the table is in (that's `environment` on the table).
   * Tabs opened before tables could change rooms throw away a view that says anything else,
   * and servers from before then drop a saved table without it.
   */
  environment: z.literal("basement"),
});
export type TableSettings = z.infer<typeof TableSettings>;

export const PublicPlayer = z.object({
  id: z.string(),
  name: z.string(),
  look: Look,
  seat: z.number(), // 0..MAX_PLAYERS-1, dealer is -1
  isDealer: z.boolean(),
  connected: z.boolean(),
  plays: z.boolean(), // false for a dealer who sits out
  hasVoted: z.boolean(),
  /** Everyone's once the cards are up; before that only your own. */
  vote: z.number().nullable(),
  chips: z.number(),
  lastWin: z.number(),
});
export type PublicPlayer = z.infer<typeof PublicPlayer>;

export const RoundResult = z.object({
  key: z.string(),
  summary: z.string(),
  finalPoints: z.number(),
  pot: z.number(),
  winners: z.array(z.string()), // names
  share: z.number(),
  /** Nobody was within one card, so the dealer raked in the pot. */
  houseWon: z.boolean().optional(),
});
export type RoundResult = z.infer<typeof RoundResult>;

/** What one player gets to see of the table. */
export const TableView = z.object({
  code: z.string(),
  phase: Phase,
  round: z.number(),
  ticket: Ticket.nullable(),
  players: z.array(PublicPlayer),
  pot: z.number(), // sum of votes, known once revealed
  finalPoints: z.number().nullable(),
  winners: z.array(z.string()), // player ids
  share: z.number(),
  /** Nobody was within one card of the final call; `winners` is the dealer. */
  houseWon: z.boolean(),
  history: z.array(RoundResult),
  /** Ticket keys the dealer skipped this session. */
  skipped: z.array(z.string()),
  jiraEnabled: z.boolean(),
  settings: TableSettings,
  /** Which room the table is in. One this tab doesn't know yet shows as the default. */
  environment: z.enum(ENVIRONMENT_IDS).catch(DEFAULT_ENVIRONMENT),
  /** Set when the dealer loaded an epic; its children become the queue. */
  epic: Epic.nullable(),
  queue: z.array(TicketSummary),
  queueLabel: z.string(),
});
export type TableView = z.infer<typeof TableView>;

const msg = <T extends string, S extends z.ZodRawShape>(t: T, shape: S) => z.object({ t: z.literal(t), ...shape });

// ---------- effects: change no state, relayed and never stored ----------

/** Effects a browser sends: where you look, how loud you talk, emotes. */
export const ClientFx = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("gaze"), yaw: z.number(), pitch: z.number() }),
  /** Mic loudness 0..1 (never audio), so your bean's mouth moves while you talk. */
  z.object({ kind: z.literal("talk"), level: z.number() }),
  z.object({ kind: z.literal("emote"), emote: z.enum(EMOTE_IDS) }),
  /** Someone clicked the squeaky on the felt; everyone else's room plays its squeak. */
  z.object({ kind: z.literal("squeak") }),
]);
export type ClientFx = z.infer<typeof ClientFx>;

/** Effects everyone sees, including ones the server makes from commands. */
export const Fx = z.discriminatedUnion("kind", [
  ...ClientFx.options,
  /** A chip flies at someone's head. */
  z.object({ kind: z.literal("flick"), to: z.string() }),
  /** Someone swapped their face-down card (others only see them fiddle with it). */
  z.object({ kind: z.literal("adjust") }),
]);
export type Fx = z.infer<typeof Fx>;

// ---------- browser → server ----------

export const JoinMsg = msg("join", {
  name: z.string().max(200),
  look: LookInput,
  token: z.string().max(100).optional(),
  dealerKey: z.string().max(100).optional(),
});
export type JoinMsg = z.infer<typeof JoinMsg>;

export const FxMsg = msg("fx", { fx: ClientFx });

/**
 * A command in its envelope; the server answers each one with a `result`. The
 * commands themselves are defined in server/table/commands.ts, and the table
 * checks each one against its own definition, so here it only needs a name.
 */
export const CommandMsg = msg("cmd", { id: z.number(), cmd: z.looseObject({ t: z.string() }) });
export type CommandMsg = z.infer<typeof CommandMsg>;

export const ClientMsg = z.discriminatedUnion("t", [JoinMsg, FxMsg, CommandMsg]);
export type ClientMsg = z.infer<typeof ClientMsg>;

// ---------- HTTP ----------

/** A Jira Cloud site the signed-in dealer can load tickets from. */
export const JiraSite = z.object({ id: z.string(), name: z.string(), url: z.string() });
export type JiraSite = z.infer<typeof JiraSite>;

/** POST /api/rooms's body: which of your Jira sites the table uses, once you've picked one. */
export const OpenRequest = z.object({ site: z.string().optional() });
export type OpenRequest = z.infer<typeof OpenRequest>;

/** POST /api/rooms: a new table, and the key that makes you its dealer. */
export const OpenedTable = z.object({ code: z.string(), dealerKey: z.string() });
export type OpenedTable = z.infer<typeof OpenedTable>;

/**
 * POST /api/rooms refused: `signIn` (401) when the dealer has to sign in with Jira first,
 * `sites` (409) when they have more than one Jira site and have to pick.
 */
export const OpenRefusal = z.object({
  error: z.string(),
  signIn: z.boolean().optional(),
  sites: z.array(JiraSite).optional(),
});
export type OpenRefusal = z.infer<typeof OpenRefusal>;

/**
 * GET /api/host: how opening a table works on this server. `jira` is "signIn" when dealers sign
 * in with their own Jira account (then `user` is who's signed in, or null), "off" otherwise.
 */
export const HostInfo = z.object({
  jira: z.enum(["signIn", "off"]),
  user: z.object({ name: z.string() }).nullable(),
});
export type HostInfo = z.infer<typeof HostInfo>;

/** GET /api/rooms/:code (a 404 when `exists` is false). */
export const TableInfo = z.object({ exists: z.boolean(), jiraEnabled: z.boolean(), needsPasscode: z.boolean() });
export type TableInfo = z.infer<typeof TableInfo>;

// ---------- server → browser ----------

export const ServerMsg = z.discriminatedUnion("t", [
  msg("welcome", { playerId: z.string(), token: z.string() }),
  msg("view", { view: TableView }),
  msg("fx", { from: z.string(), fx: Fx }),
  /** The answer to a command: no error means it worked. */
  msg("result", { id: z.number(), error: z.string().optional() }),
  /** Something the table should hear about (a skip, a kick…). */
  msg("toast", { text: z.string(), level: z.enum(["info", "error"]).optional() }),
]);
export type ServerMsg = z.infer<typeof ServerMsg>;
