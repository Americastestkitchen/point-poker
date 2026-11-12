// Pure scoring rules, kept separate so they're easy to test.

import { DECK } from "../shared/protocol.ts";

export interface Settlement {
  pot: number;
  winners: string[];
  share: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * The pot is the sum of every played card. Whoever is closest to the
 * dealer's final value wins it; ties split it evenly. You also have to be
 * within one card of the final value (final 5 pays 3, 5 or 8), otherwise the
 * house keeps the pot, so a lone or wildly-off player can't win by default.
 */
export function settle(votes: Map<string, number>, finalPoints: number): Settlement {
  let pot = 0;
  for (const v of votes.values()) pot += v;
  const deck = DECK as readonly number[];
  const target = deck.indexOf(finalPoints);
  const inRange = [...votes].filter(([, v]) => Math.abs(deck.indexOf(v) - target) <= 1);
  if (!inRange.length) return { pot, winners: [], share: 0 };
  const best = Math.min(...inRange.map(([, v]) => Math.abs(v - finalPoints)));
  const winners = inRange.filter(([, v]) => Math.abs(v - finalPoints) === best).map(([id]) => id);
  return { pot, winners, share: round2(pot / winners.length) };
}
