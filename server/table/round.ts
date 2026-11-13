// The round's state machine: which moves each phase allows, and the only
// functions that change the phase. The table checks here before it runs a
// command (each one names its move), so a move the phase doesn't allow is
// refused with a reason instead of quietly doing nothing.
//
// waiting ──deal──▶ voting ──reveal──▶ revealed ──settle──▶ settled
//    ▲  (a ticket)    │ ▲                  │                  │ settle again
//    │                │ └──deal (restart)──┴──────────────────┘ replaces the call
//    └──cancel/skip (voting or revealed), next round (any phase): endRound()
//
// A table is waiting exactly when there's no ticket out.
import type { Phase, Ticket } from "../../shared/protocol.ts";
import { potOf } from "./coins.ts";
import type { TableState } from "./state.ts";

/** For every move and every phase: allowed, or why not. */
const RULES = {
  vote: {
    waiting: "There's nothing to vote on yet",
    voting: true,
    revealed: "Voting is over",
    settled: "Voting is over",
  },
  /** Deals the ticket that's out again: everyone votes from scratch. */
  deal: { waiting: "Load a ticket first", voting: true, revealed: true, settled: true },
  reveal: {
    waiting: "There's no vote to reveal",
    voting: true,
    revealed: "The cards are already up",
    settled: "The cards are already up",
  },
  /** Settling again replaces the last call. */
  settle: { waiting: "Reveal the cards first", voting: "Reveal the cards first", revealed: true, settled: true },
  cancel: {
    waiting: "There's no round to cancel",
    voting: true,
    revealed: true,
    settled: "This round is already paid out",
  },
  skip: {
    waiting: "There's no ticket to skip",
    voting: true,
    revealed: true,
    settled: "This round is already paid out",
  },
} as const satisfies Record<string, Record<Phase, true | string>>;

export type Move = keyof typeof RULES;

/** Why `move` can't happen in this phase, or undefined when it can. */
export function refusal(s: TableState, move: Move): string | undefined {
  const rule: true | string = RULES[move][s.phase];
  return rule === true ? undefined : rule;
}

/** A new vote on `ticket` (or the one that's out): everyone starts empty-handed. */
export function startRound(s: TableState, ticket?: Ticket) {
  if (ticket) s.ticket = ticket;
  s.phase = "voting";
  s.round += 1;
  clearRound(s);
}

/** The cards go up, and the pot is what they add up to. */
export function reveal(s: TableState) {
  s.phase = "revealed";
  s.pot = potOf(s.players);
}

/** The dealer's call, and who it paid. */
export function settleRound(
  s: TableState,
  finalPoints: number,
  result: { pot: number; winners: string[]; share: number; houseWon: boolean },
) {
  s.phase = "settled";
  s.finalPoints = finalPoints;
  s.pot = result.pot;
  s.winners = result.winners;
  s.share = result.share;
  s.houseWon = result.houseWon;
}

/** Back to waiting, with no ticket out and nothing on the table. */
export function endRound(s: TableState) {
  s.phase = "waiting";
  s.ticket = null;
  clearRound(s);
}

function clearRound(s: TableState) {
  s.finalPoints = null;
  s.winners = [];
  s.share = 0;
  s.houseWon = false;
  s.pot = 0;
  for (const p of s.players) {
    p.vote = null;
    p.lastWin = 0;
  }
}
