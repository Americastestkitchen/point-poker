// Messages and state shared by the server and the browser client.
// Every message is a Zod schema; the TypeScript types come from the schemas.
import { z } from "zod";
import { DECKS } from "./catalog/decks.ts";

/** The cards in every player's hand. */
export const DECK = DECKS.classic.cards.map((c) => c.points!) as readonly number[];

export const MAX_PLAYERS = 8; // not counting the dealer

export const COLORS = [
  "#ff6b4a", "#ffd23f", "#3bceac", "#5b8cff", "#c56bff",
  "#ff5fa2", "#8ce05a", "#ff9f1c", "#4ad6ff", "#e8e1d0",
] as const;

export const HATS = [
  "none", "beanie", "tophat", "cone", "party", "chef", "horns", "fez", "crown",
] as const;
export type Hat = (typeof HATS)[number];

/** Body shapes. All goofy, none dignified. */
export const BODIES = ["bean", "chonk", "noodle", "box", "pear"] as const;
export type Body = (typeof BODIES)[number];

export const EMOTES = ["wave", "laugh", "think", "shock"] as const;
export type Emote = (typeof EMOTES)[number];

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

export const PublicPlayer = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  hat: z.enum(HATS),
  body: z.enum(BODIES),
  seat: z.number(), // 0..MAX_PLAYERS-1, dealer is -1
  isDealer: z.boolean(),
  connected: z.boolean(),
  plays: z.boolean(), // false for a dealer who sits out
  hasVoted: z.boolean(),
  vote: z.number().nullable(), // only filled in once revealed
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

export const RoomState = z.object({
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
  dealerPlays: z.boolean(),
  /** Set when the dealer loaded an epic; its children become the queue. */
  epic: Epic.nullable(),
  queue: z.array(TicketSummary),
  queueLabel: z.string(),
});
export type RoomState = z.infer<typeof RoomState>;

// ---------- browser → server ----------

const msg = <T extends string, S extends z.ZodRawShape>(t: T, shape: S) => z.object({ t: z.literal(t), ...shape });

export const JoinMsg = msg("join", {
  name: z.string(),
  color: z.string(),
  hat: z.string(),
  body: z.string().optional(),
  token: z.string().optional(),
  dealerKey: z.string().optional(),
});
export type JoinMsg = z.infer<typeof JoinMsg>;

/** Things that change no state: the server relays them and never stores them. */
export const FxMsg = z.discriminatedUnion("t", [
  msg("look", { yaw: z.number(), pitch: z.number() }),
  msg("emote", { kind: z.enum(EMOTES) }),
  /** Mic loudness 0..1 (never audio), so your bean's mouth moves while you talk. */
  msg("talk", { level: z.number() }),
]);
export type FxMsg = z.infer<typeof FxMsg>;

/** Everything that can change the table. Each one is checked against its schema and role on the server. */
export const Commands = {
  vote: msg("vote", { value: z.number().nullable() }),
  flick: msg("flick", { target: z.string() }),
  style: msg("style", { color: z.string(), hat: z.string(), body: z.string().optional() }),
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

export const ClientMsg = z.discriminatedUnion("t", [JoinMsg, ...FxMsg.options, ...Object.values(Commands)]);
export type ClientMsg = z.infer<typeof ClientMsg>;

// ---------- server → browser ----------

export const ServerMsg = z.discriminatedUnion("t", [
  msg("welcome", { playerId: z.string(), token: z.string(), isDealer: z.boolean() }),
  msg("state", { state: RoomState }),
  msg("look", { id: z.string(), yaw: z.number(), pitch: z.number() }),
  msg("emote", { id: z.string(), kind: z.enum(EMOTES) }),
  msg("talk", { id: z.string(), level: z.number() }),
  msg("flick", { from: z.string(), to: z.string() }),
  /** A player swapped their face-down card (others only see them fiddle with it). */
  msg("adjust", { id: z.string() }),
  msg("toast", { text: z.string(), level: z.enum(["info", "error"]).optional() }),
  /** Sent to the dealer when a ticket, epic or sprint list couldn't be loaded. */
  msg("loadFailed", { text: z.string() }),
]);
export type ServerMsg = z.infer<typeof ServerMsg>;
