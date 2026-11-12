// Messages and state shared by the server and the browser client.

/** The cards in every player's hand. */
export const DECK = [1, 2, 3, 5, 8] as const;
export type CardValue = (typeof DECK)[number];

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

export type Phase = "waiting" | "voting" | "revealed" | "settled";

export interface Ticket {
  key: string;
  summary: string;
  description: string;
  type: string;
  status: string;
  priority: string;
  assignee: string;
  reporter: string;
  labels: string[];
  currentPoints: number | null;
  url: string;
  /** Jira's rich description (Atlassian Document Format), rendered client-side. */
  adf: unknown;
  statusCategory: "new" | "indeterminate" | "done" | "";
  parent: { key: string; summary: string } | null;
}

export interface TicketSummary {
  key: string;
  summary: string;
  points: number | null;
  status: string;
  played?: boolean;
}

export interface PublicPlayer {
  id: string;
  name: string;
  color: string;
  hat: Hat;
  body: Body;
  seat: number; // 0..MAX_PLAYERS-1, dealer is -1
  isDealer: boolean;
  connected: boolean;
  plays: boolean; // false for a dealer who sits out
  hasVoted: boolean;
  vote: number | null; // only filled in once revealed
  chips: number;
  lastWin: number;
}

export interface RoundResult {
  key: string;
  summary: string;
  finalPoints: number;
  pot: number;
  winners: string[]; // names
  share: number;
  /** Nobody was within one card, so the dealer raked in the pot. */
  houseWon?: boolean;
}

export interface RoomState {
  code: string;
  phase: Phase;
  round: number;
  ticket: Ticket | null;
  players: PublicPlayer[];
  pot: number; // sum of votes, known once revealed
  finalPoints: number | null;
  winners: string[]; // player ids
  share: number;
  /** Nobody was within one card of the final call; `winners` is the dealer. */
  houseWon: boolean;
  history: RoundResult[];
  /** Ticket keys the dealer skipped this session. */
  skipped: string[];
  jiraEnabled: boolean;
  dealerPlays: boolean;
  /** Set when the dealer loaded an epic; its children become the queue. */
  epic: { key: string; summary: string; url: string } | null;
  queue: TicketSummary[];
  queueLabel: string;
}

export type ClientMsg =
  | { t: "join"; name: string; color: string; hat: Hat; body?: Body; token?: string; dealerKey?: string }
  | { t: "vote"; value: number | null }
  | { t: "look"; yaw: number; pitch: number }
  | { t: "emote"; kind: Emote }
  /** Mic loudness 0..1 (never audio), so your bean's mouth moves while you talk. */
  | { t: "talk"; level: number }
  | { t: "flick"; target: string }
  | { t: "style"; color: string; hat: Hat; body?: Body }
  // dealer only
  | { t: "loadTicket"; ref: string }
  | { t: "manualTicket"; key: string; summary: string; description: string }
  | { t: "fetchQueue"; jql?: string }
  | { t: "dealerPlays"; plays: boolean }
  | { t: "deal" }
  | { t: "reveal" }
  | { t: "settle"; finalPoints: number }
  | { t: "nextRound" }
  /** Drop the current round (no payout) and go back to picking a ticket. */
  | { t: "cancelRound" }
  /** Skip the current ticket (no payout) and deal the next one in the queue. */
  | { t: "skip" }
  | { t: "clearQueue" }
  | { t: "kick"; id: string };

export type ServerMsg =
  | { t: "welcome"; playerId: string; token: string; isDealer: boolean }
  | { t: "state"; state: RoomState }
  | { t: "look"; id: string; yaw: number; pitch: number }
  | { t: "emote"; id: string; kind: Emote }
  | { t: "talk"; id: string; level: number }
  | { t: "flick"; from: string; to: string }
  /** A player swapped their face-down card (others only see them fiddle with it). */
  | { t: "adjust"; id: string }
  | { t: "toast"; text: string; level?: "info" | "error" }
  /** Sent to the dealer when a ticket, epic or sprint list couldn't be loaded. */
  | { t: "loadFailed"; text: string };
