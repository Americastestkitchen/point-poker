import { test } from "node:test";
import assert from "node:assert/strict";
import { potMove } from "./pot.ts";

const round = (
  phase: "waiting" | "voting" | "revealed" | "settled",
  now: { revealed?: boolean; settled?: boolean; resettled?: boolean } = {},
) => ({ phase, revealedNow: !!now.revealed, settledNow: !!now.settled, resettled: !!now.resettled });

test("the pot fills when the cards go up, or when you arrive mid-reveal", () => {
  assert.equal(potMove("empty", round("revealed", { revealed: true })), "fill");
  assert.equal(potMove("empty", round("revealed")), "fill", "you arrived after the reveal");
  assert.equal(potMove("full", round("revealed")), null, "someone joined: leave it be");
});

test("it pays out on the first call, and empties when the call changes", () => {
  assert.equal(potMove("full", round("settled", { settled: true })), "payOut");
  assert.equal(potMove("payingOut", round("settled", { settled: true, resettled: true })), "clear");
  assert.equal(potMove("empty", round("settled", { settled: true, resettled: true })), null);
  assert.equal(potMove("empty", round("settled")), null, "arriving after the payout: nothing to show");
});

test("a new vote or no round empties it", () => {
  assert.equal(potMove("full", round("voting")), "clear");
  assert.equal(potMove("payingOut", round("waiting")), "clear");
  assert.equal(potMove("empty", round("voting")), null);
});
