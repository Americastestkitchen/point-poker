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

/** The values you can play from a deck (cards with points). */
export const cardValues = (cards: readonly Card[]): number[] =>
  cards.flatMap((c) => (c.points === null ? [] : [c.points]));

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
