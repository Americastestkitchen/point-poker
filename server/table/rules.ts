// The round's rules as plain functions over TableState. No I/O, no clocks.
import { cardValues } from "../../shared/catalog/decks.ts";
import { BODIES, COLORS, HATS, MAX_PLAYERS, type Body, type Hat, type Ticket } from "../../shared/protocol.ts";
import type { PlayerState, TableState } from "./state.ts";

export const isDealer = (s: TableState, p: PlayerState) => p.id === s.dealerId;
/** The dealer only votes when they chose to play along. */
export const isVoter = (s: TableState, p: PlayerState) => !isDealer(s, p) || s.settings.dealerPlays;
export const findPlayer = (s: TableState, id: string) => s.players.find((p) => p.id === id);

export const clean = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, max);
export const pickColor = (c: unknown) => (COLORS as readonly string[]).includes(String(c)) ? String(c) : COLORS[0];
export const pickHat = (h: unknown): Hat => (HATS as readonly string[]).includes(String(h)) ? (h as Hat) : "none";
export const pickBody = (b: unknown): Body => (BODIES as readonly string[]).includes(String(b)) ? (b as Body) : "bean";

/** A playable card value from this table's deck, or null. */
export const pickVote = (s: TableState, v: number | null) => v !== null && cardValues(s.settings.deck).includes(v) ? v : null;

/** The first free seat, or -2 when the table is full. */
export function freeSeat(s: TableState): number {
  const taken = new Set(s.players.map((p) => p.seat));
  for (let i = 0; i < MAX_PLAYERS; i++) if (!taken.has(i)) return i;
  return -2;
}

function clearRound(s: TableState) {
  s.finalPoints = null;
  s.winners = [];
  s.share = 0;
  s.houseWon = false;
  s.pot = 0;
  for (const p of s.players) { p.vote = null; p.lastWin = 0; }
}

export function startRound(s: TableState) {
  s.phase = "voting";
  s.round += 1;
  clearRound(s);
}

export function resetTable(s: TableState) {
  s.phase = "waiting";
  clearRound(s);
}

/** First queued ticket that hasn't been played yet, preferring ones with no points. */
export function nextInQueue(s: TableState) {
  const played = new Set([...s.history.map((h) => h.key), ...s.skipped]);
  if (s.ticket) played.add(s.ticket.key);
  const open = s.queue.filter((q) => !played.has(q.key));
  return open.find((q) => q.points === null) ?? open[0];
}

export function manualTicket(key: string, summary: string, description: string): Ticket {
  return {
    key: key || "TICKET", summary, description,
    type: "", status: "", priority: "", assignee: "", reporter: "", labels: [], currentPoints: null, url: "",
    adf: null, statusCategory: "", parent: null,
  };
}
