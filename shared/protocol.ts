// Messages and views shared by the server and the browser client.
// Every message is a Zod schema; the TypeScript types come from the schemas.
import { z } from "zod";
import { EMOTE_IDS } from "./catalog/emotes.ts";
import { ENVIRONMENT_IDS } from "./catalog/environments.ts";
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

/** The deck, the extra house rules and where the table is. */
export const TableSettings = z.object({
  deck: z.array(Card),
  dealerPlays: z.boolean(),
  environment: z.enum(ENVIRONMENT_IDS),
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

/** Everything that can change the table. Each one is checked against its schema and role on the server. */
export const Commands = {
  vote: msg("vote", { value: z.number().nullable() }),
  /** Flick a chip at someone. Has a cooldown. */
  flick: msg("flick", { target: z.string() }),
  setLook: msg("setLook", { look: LookInput }),
  // dealer only
  loadTicket: msg("loadTicket", { ref: z.string().max(2000) }),
  manualTicket: msg("manualTicket", { key: z.string(), summary: z.string(), description: z.string() }),
  fetchQueue: msg("fetchQueue", {}),
  dealerPlays: msg("dealerPlays", { plays: z.boolean() }),
  deal: msg("deal", {}),
  reveal: msg("reveal", {}),
  settle: msg("settle", { finalPoints: z.number() }),
  nextRound: msg("nextRound", {}),
  /** Drop the current round (no payout) and go back to picking a ticket. */
  cancelRound: msg("cancelRound", {}),
  /** Skip the current ticket (no payout) and deal the next one in the queue. */
  skip: msg("skip", {}),
  clearQueue: msg("clearQueue", {}),
  kick: msg("kick", { id: z.string() }),
} as const;
export type Command = z.infer<(typeof Commands)[keyof typeof Commands]>;

/** On the wire a command rides in an envelope with an id; the server answers each with a `result`. */
type CommandSchema = (typeof Commands)[keyof typeof Commands];
export const AnyCommand = z.discriminatedUnion("t", Object.values(Commands) as [CommandSchema, ...CommandSchema[]]);
export const CommandMsg = msg("cmd", { id: z.number(), cmd: AnyCommand });
export type CommandMsg = z.infer<typeof CommandMsg>;

export const ClientMsg = z.discriminatedUnion("t", [JoinMsg, FxMsg, CommandMsg]);
export type ClientMsg = z.infer<typeof ClientMsg>;

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
