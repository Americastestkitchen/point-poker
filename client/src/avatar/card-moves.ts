// How a bean puts its card down: a pat, a slam, a toss, a sneaky slide or a dainty set-down.
// Each body type has its own taste in moves (a chonk slams, a pear is dainty), and the move is
// picked from a seed every screen already has, so the whole table sees the same one. The beats
// say when the card leaves the hand and lands, so the card and its sounds keep time with the
// arm. No three.js here: the animator poses the moves, and the table times the card from these.
import type { BodyId } from "../../../shared/catalog/bodies.ts";

export const MOVES = ["pat", "slam", "toss", "sneaky", "dainty"] as const;
export type CardMove = (typeof MOVES)[number];

/**
 * How a card comes down out of a hand: set down low and flat (`gentle`), tossed in an arc
 * (`toss`), smacked down (`slap`), smacked down so hard it bounces (`slam`), flicked spinning
 * so it skids in (`skid`), or slid along the felt (`slide`).
 */
export type Landing = "gentle" | "toss" | "slap" | "slam" | "skid" | "slide";

/** Seconds from leaving the hand to lying on the felt. */
export const LANDING_TIME: Record<Landing, number> = {
  gentle: 0.42,
  toss: 0.42,
  slap: 0.17,
  slam: 0.12,
  skid: 0.55,
  slide: 0.45,
};

/** When things happen in a move, in seconds from its start. */
export interface Beats {
  move: CardMove;
  /** The card leaves the hand. */
  release: number;
  landing: Landing;
  /** It's on the felt. */
  land: number;
  /** The hand gives it a pat once it's down, if this move does. */
  pat: number | null;
  /** The arm is back at rest. */
  length: number;
}

const beats = (move: CardMove, release: number, landing: Landing, pat: number | null, length: number): Beats => ({
  move,
  release,
  landing,
  land: release + LANDING_TIME[landing],
  pat,
  length,
});

export const CARD_MOVES: Record<CardMove, Beats> = {
  /** Lean in, set it down from the hand, pat it. */
  pat: beats("pat", 0.3, "gentle", 0.65, 1.05),
  /** Hoisted up, then the whole body goes into bringing it down; the bean squashes, the card bounces. */
  slam: beats("slam", 0.34, "slam", null, 1.05),
  /** Flicked from the chair without reaching: it spins and skids into place. */
  toss: beats("toss", 0.28, "skid", null, 1.0),
  /** A look left, a look right, then it slides in low along the felt. */
  sneaky: beats("sneaky", 0.5, "slide", null, 1.15),
  /** Held up high, a pause, then set down ever so gently. */
  dainty: beats("dainty", 0.6, "gentle", null, 1.2),
};

/** How much each body type goes for each move. Tuned by feel: a few rounds should tell them apart. */
export const STYLE: Record<BodyId, Record<CardMove, number>> = {
  /** The everyman: a bit of everything, mostly a pat or a toss. */
  bean: { pat: 3, toss: 3, slam: 1, sneaky: 1, dainty: 1 },
  /** Heavy and proud. */
  chonk: { slam: 6, pat: 3, toss: 1, sneaky: 0, dainty: 0 },
  /** Loose and stretchy: flings it from far away. */
  noodle: { toss: 6, pat: 1, slam: 1, sneaky: 1, dainty: 1 },
  /** Stiff and precise. */
  box: { pat: 4, sneaky: 4, dainty: 1, slam: 0, toss: 0 },
  /** Dramatic. */
  pear: { dainty: 6, sneaky: 2, pat: 1, toss: 1, slam: 0 },
};

/** Changing your card after the reveal starts by reaching out and grabbing the old one: it's in the hand at this. */
export const SWAP_GRAB = 0.28;

/** A swap: grab the old card, then put the new one down with `move`. Its beats, from the start of the grab. */
export function swapBeats(move: CardMove): Beats & { grab: number } {
  const b = CARD_MOVES[move];
  const after = (s: number) => SWAP_GRAB + s;
  return {
    ...b,
    grab: SWAP_GRAB,
    release: after(b.release),
    land: after(b.land),
    pat: b.pat === null ? null : after(b.pat),
    length: after(b.length),
  };
}

/** The move `body` makes for this seed: the same seed always gets the same move. */
export function pickMove(body: BodyId, seed: string): CardMove {
  const style = STYLE[body];
  const total = MOVES.reduce((sum, m) => sum + style[m], 0);
  let roll = roll01(seed) * total;
  for (const move of MOVES) {
    roll -= style[move];
    if (style[move] > 0 && roll < 0) return move;
  }
  return "pat";
}

/** What everyone at the table can agree on for one player's card: who, which deal, and for a swap, the card it's swapped to. */
export function cardSeed(playerId: string, round: number, swappedTo?: number): string {
  return swappedTo === undefined ? `${playerId}:${round}` : `${playerId}:${round}:swap:${swappedTo}`;
}

/** A number in [0, 1) from a string, the same on every screen (FNV-1a, then mixed so close seeds land far apart). */
export function roll01(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 2 ** 32;
}
