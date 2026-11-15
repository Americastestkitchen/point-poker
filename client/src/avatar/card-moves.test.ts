import { test } from "node:test";
import assert from "node:assert/strict";
import { BODY_IDS } from "../../../shared/catalog/bodies.ts";
import { cardSeed, MOVES, pickMove, roll01, STYLE, type CardMove } from "./card-moves.ts";

/** How often `body` picks each move over many deals. */
function tally(body: (typeof BODY_IDS)[number], deals = 4000) {
  const seen = Object.fromEntries(MOVES.map((m) => [m, 0])) as Record<CardMove, number>;
  for (let round = 1; round <= deals; round++) seen[pickMove(body, cardSeed(`player-${round % 7}`, round))]++;
  return seen;
}

test("the same seed always gets the same move, so every screen sees the same one", () => {
  for (const body of BODY_IDS) {
    for (let round = 1; round < 50; round++) {
      const seed = cardSeed("abc123", round);
      assert.equal(pickMove(body, seed), pickMove(body, seed));
    }
  }
  assert.equal(roll01("abc123:7"), roll01("abc123:7"));
});

test("the same player gets different moves across rounds", () => {
  for (const body of BODY_IDS) {
    const moves = new Set(Array.from({ length: 12 }, (_, i) => pickMove(body, cardSeed("abc123", i + 1))));
    assert.ok(moves.size > 1, `${body} doesn't do the same thing every round`);
  }
});

test("a swap gets its own move, and swapping to another card can get another", () => {
  assert.notEqual(cardSeed("abc", 3), cardSeed("abc", 3, 5));
  const swaps = new Set([1, 2, 3, 5, 8, 13, 21].map((v) => pickMove("bean", cardSeed("abc", 3, v))));
  assert.ok(swaps.size > 1);
});

test("rolls spread evenly from 0 to 1", () => {
  const buckets = Array.from({ length: 10 }, () => 0);
  for (let i = 0; i < 10000; i++) {
    const r = roll01(cardSeed(`p${i % 13}`, i));
    assert.ok(r >= 0 && r < 1);
    buckets[Math.floor(r * 10)]!++;
  }
  for (const b of buckets) assert.ok(b > 850 && b < 1150, `bucket of ${b}`);
});

test("each body type picks moves by its own weights", () => {
  for (const body of BODY_IDS) {
    const seen = tally(body);
    const style = STYLE[body];
    const total = MOVES.reduce((sum, m) => sum + style[m], 0);
    for (const move of MOVES) {
      const want = style[move] / total;
      const got = seen[move] / 4000;
      if (want === 0) assert.equal(seen[move], 0, `${body} never does a ${move}`);
      else
        assert.ok(
          Math.abs(got - want) < 0.04,
          `${body} does a ${move} ${(got * 100).toFixed(0)}% of the time, not ${(want * 100).toFixed(0)}%`,
        );
    }
  }
});

test("you can tell the body types apart by their favourite move", () => {
  const favourite = (body: (typeof BODY_IDS)[number]) =>
    MOVES.reduce((best, m) => (tally(body)[m] > tally(body)[best] ? m : best));
  assert.equal(favourite("chonk"), "slam");
  assert.equal(favourite("noodle"), "toss");
  assert.equal(favourite("pear"), "dainty");
  assert.ok(["pat", "sneaky"].includes(favourite("box")));
});
