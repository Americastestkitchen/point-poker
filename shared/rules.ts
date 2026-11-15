// Rules both the server and the browser use, as plain functions.
import type { Card } from "./protocol.ts";

export const MAX_PLAYERS = 8; // not counting the dealer
/** A table's code: four letters, no vowels (so codes never spell words) and no Y. */
export const TABLE_CODE = { length: 4, letters: "BCDFGHJKLMNPQRSTVWXZ" } as const;

const KEY_RE = /\b([A-Z][A-Z0-9_]+-\d+)\b/;

/** Pulls an issue key out of a pasted link (browse/, selectedIssue=, etc.) or a bare key. */
export function parseIssueKey(ref: string): string | null {
  const m = ref.trim().toUpperCase().match(KEY_RE);
  return m?.[0] ?? null;
}

/** Whether someone votes: everyone but a dealer who sits out. */
export const plays = (isDealer: boolean, dealerPlays: boolean) => !isDealer || dealerPlays;

/** Everyone who votes this round. */
export const voters = <P extends { plays: boolean }>(players: readonly P[]) => players.filter((p) => p.plays);

/** Every voter has a card down. */
export const allIn = (players: readonly { plays: boolean; hasVoted: boolean }[]) => {
  const v = voters(players);
  return v.length > 0 && v.every((p) => p.hasVoted);
};

/** The points on a deck's cards: what a round can be settled on. */
export const cardValues = (cards: readonly Card[]): number[] =>
  cards.flatMap((c) => (c.points === null ? [] : [c.points]));

/**
 * What playing each card of a deck sends, in deck order: its points, or for a card with none
 * ("?") minus its place in the deck, so it can never be taken for points.
 */
export const playValues = (cards: readonly Card[]): number[] => cards.map((c, i) => c.points ?? -(i + 1));

/** The card a played value stands for, if this deck has it. */
export function cardOf(cards: readonly Card[], value: number): Card | undefined {
  if (value >= 0) return cards.find((c) => c.points === value);
  const card = cards[-value - 1];
  return card?.points === null ? card : undefined;
}

/** What a played card says: "5", "M", "?". A value the deck doesn't know says its number. */
export const cardLabel = (cards: readonly Card[], value: number): string =>
  cardOf(cards, value)?.label ?? String(value);

/** Whether a played value is worth points: the extra cards ("?", "☕") aren't. */
export const scores = (value: number) => value >= 0;

/** Who played which card: value → players, in deck order. */
export function tally<P extends { vote: number | null }>(players: readonly P[]): Map<number, P[]> {
  const counts = new Map<number, P[]>();
  for (const p of players) if (p.vote !== null) counts.set(p.vote, [...(counts.get(p.vote) ?? []), p]);
  return counts;
}

/** The card most people played, when there clearly is one (two or more, no tie). */
export function favourite(counts: Map<number, unknown[]>): number | null {
  let top = -1,
    best = 0;
  for (const [v, ps] of counts)
    if (ps.length > best || (ps.length === best && v > top)) {
      best = ps.length;
      top = v;
    }
  if (best < 2 || [...counts.values()].filter((ps) => ps.length === best).length > 1) return null;
  return top;
}

/** First queued ticket that hasn't been played, skipped or dealt yet, preferring ones with no points. */
export function nextInQueue<Q extends { key: string; points: number | null }>(t: {
  queue: readonly Q[];
  history: readonly { key: string }[];
  skipped: readonly string[];
  ticket: { key: string } | null;
}): Q | undefined {
  const played = new Set([...t.history.map((h) => h.key), ...t.skipped]);
  if (t.ticket) played.add(t.ticket.key);
  const open = t.queue.filter((q) => !played.has(q.key));
  return open.find((q) => q.points === null) ?? open[0];
}
