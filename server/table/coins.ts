// Where coins move: the pot, payouts, the house and taking a payout back.
// Whatever the economy rework decides changes this file only.
import type { Card } from "../../shared/protocol.ts";
import type { PlayerState, TableState } from "./state.ts";

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
 * "One card" is one step along the deck's order.
 */
export function settle(votes: Map<string, number>, finalPoints: number, deck: readonly Card[]): Settlement {
  let pot = 0;
  for (const v of votes.values()) pot += v;
  const order = deck.map((c) => c.points);
  const target = order.indexOf(finalPoints);
  const inRange = [...votes].filter(([, v]) => Math.abs(order.indexOf(v) - target) <= 1);
  if (!inRange.length) return { pot, winners: [], share: 0 };
  const best = Math.min(...inRange.map(([, v]) => Math.abs(v - finalPoints)));
  const winners = inRange.filter(([, v]) => Math.abs(v - finalPoints) === best).map(([id]) => id);
  return { pot, winners, share: round2(pot / winners.length) };
}

/** What's on the table once the cards flip: every card played this round. */
export const potOf = (players: readonly PlayerState[]) => players.reduce((sum, p) => sum + (p.vote ?? 0), 0);

/** The dealer changed their mind: undo the last payout. */
export function takeBack(players: PlayerState[]) {
  for (const p of players) {
    p.chips = round2(p.chips - p.lastWin);
    p.lastWin = 0;
  }
}

/** Pays the pot out. Nobody close enough means the house (the dealer) rakes it in. */
export function payOut(
  s: TableState,
  votes: Map<string, number>,
  finalPoints: number,
): Settlement & { houseWon: boolean } {
  const result = settle(votes, finalPoints, s.settings.deck);
  const dealer = s.players.find((p) => p.id === s.dealerId);
  const houseWon = !result.winners.length && result.pot > 0 && !!dealer;
  if (houseWon) {
    result.winners = [dealer!.id];
    result.share = result.pot;
  }
  for (const id of result.winners) {
    const w = s.players.find((p) => p.id === id)!;
    w.chips = round2(w.chips + result.share);
    w.lastWin = result.share;
  }
  return { ...result, houseWon };
}
