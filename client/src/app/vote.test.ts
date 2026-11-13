import { test } from "node:test";
import assert from "node:assert/strict";
import { vote, type VoteAction, type VoteState } from "./vote.ts";

const run = (...actions: VoteAction[]) => actions.reduce<VoteState>(vote, { myVote: null, votesInFlight: 0 });

test("your card shows at once, and views from before your vote don't take it back", () => {
  assert.deepEqual(run({ t: "played", value: 3 }, { t: "view", server: null }), { myVote: 3, votesInFlight: 1 });
});

test("once the server answers, your view decides again", () => {
  assert.deepEqual(run({ t: "played", value: 3 }, { t: "answered", server: 3 }), { myVote: 3, votesInFlight: 0 });
  assert.deepEqual(run({ t: "played", value: 3 }, { t: "answered", server: null }), { myVote: null, votesInFlight: 0 }, "a refused vote goes back");
  assert.deepEqual(run({ t: "played", value: 3 }, { t: "answered", server: 3 }, { t: "view", server: null }).myVote, null, "a new round clears it");
});

test("with two votes out, only the last answer hands back to the view", () => {
  const out = run({ t: "played", value: 3 }, { t: "played", value: 5 }, { t: "answered", server: 3 });
  assert.deepEqual(out, { myVote: 5, votesInFlight: 1 });
  assert.deepEqual(vote(out, { t: "answered", server: 5 }), { myVote: 5, votesInFlight: 0 });
});

test("nothing changes when there's nothing new", () => {
  const s: VoteState = { myVote: 3, votesInFlight: 0 };
  assert.equal(vote(s, { t: "view", server: 3 }), s);
});
