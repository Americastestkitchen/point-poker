import { test } from "node:test";
import assert from "node:assert/strict";
import { ticket, view, withPlayers } from "../../app/fixtures.ts";
import { statusModel } from "./status.ts";

const steps = (s: ReturnType<typeof statusModel>) => s.steps.map((x) => `${x.label}:${x.state}`).join(" ");

test("waiting: no step yet, and the line depends on who you are", () => {
  const room = view();
  const s = statusModel(room, "deb", null);
  assert.equal(steps(s), "Pick:idle Reveal:idle Settle:idle");
  assert.equal(s.idle, true);
  assert.equal(s.line, "Add a ticket to start");
  assert.equal(statusModel(room, "ann", null).line, "Waiting for the dealer to add a ticket…");
  assert.equal(s.voters, null);
});

test("voting: Pick is current; a voter without a card is told to pick, everyone else sees the count", () => {
  const room = withPlayers(view({ phase: "voting", round: 1, ticket: ticket("SD-1") }), (p) =>
    p.id === "bob" ? { hasVoted: true } : {},
  );
  const s = statusModel(room, "ann", null);
  assert.equal(steps(s), "Pick:current Reveal:idle Settle:idle");
  assert.equal(s.idle, false);
  assert.equal(s.line, "Pick a card below");
  assert.equal(statusModel(room, "ann", 3).line, "1 of 2 picked", "your optimistic card counts as picked for the line");
  assert.equal(statusModel(room, "deb", null).line, "1 of 2 picked", "a dealer who sits out isn't asked to pick");
  assert.deepEqual(
    s.voters?.map((v) => [v.player.id, v.voted, v.label]),
    [
      ["ann", false, "ANN is thinking…"],
      ["bob", true, "BOB ✓"],
    ],
  );
});

test("revealed: Pick done, Reveal current; the dealer chooses, players wait", () => {
  const room = view({ phase: "revealed", round: 1, ticket: ticket("SD-1") });
  const s = statusModel(room, "deb", null);
  assert.equal(steps(s), "Pick:done Reveal:current Settle:idle");
  assert.equal(s.line, "Choose the final points below");
  assert.equal(statusModel(room, "ann", null).line, "The dealer is choosing the final points…");
  assert.equal(s.voters, null, "dots only while voting");
});

test("settled: Settle current, the final call for everyone", () => {
  const room = view({ phase: "settled", round: 1, ticket: ticket("SD-1"), finalPoints: 8 });
  const s = statusModel(room, "ann", null);
  assert.equal(steps(s), "Pick:done Reveal:done Settle:current");
  assert.equal(s.line, "Final: 8 points");
  assert.equal(statusModel(room, "deb", null).line, "Final: 8 points");
});
