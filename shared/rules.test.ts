import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDeck } from "./catalog/decks.ts";
import {
  allIn,
  cardLabel,
  cardOf,
  cardValues,
  favourite,
  nextInQueue,
  parseIssueKey,
  playValues,
  scores,
  tally,
  voters,
} from "./rules.ts";

test("issue keys come out of links and bare keys", () => {
  assert.equal(parseIssueKey("https://x.atlassian.net/browse/SD-1975"), "SD-1975");
  assert.equal(
    parseIssueKey("https://x.atlassian.net/jira/software/c/projects/SD/boards/1?selectedIssue=SD-42"),
    "SD-42",
  );
  assert.equal(parseIssueKey(" sd-7 "), "SD-7");
  assert.equal(parseIssueKey("nope"), null);
});

test("who votes, and whether they're all in", () => {
  const players = [
    { id: "deb", plays: false, hasVoted: false },
    { id: "ann", plays: true, hasVoted: true },
    { id: "bob", plays: true, hasVoted: false },
  ];
  assert.deepEqual(
    voters(players).map((p) => p.id),
    ["ann", "bob"],
  );
  assert.equal(allIn(players), false);
  assert.equal(allIn(players.map((p) => ({ ...p, hasVoted: p.plays }))), true);
  assert.equal(allIn([{ plays: false, hasVoted: false }]), false, "nobody voting isn't everyone in");
});

test("tally and the favourite card", () => {
  const votes = (...v: (number | null)[]) => v.map((vote, i) => ({ id: `p${i}`, vote }));
  const t = tally(votes(3, 5, 3, null));
  assert.deepEqual(
    [...t].map(([v, ps]) => [v, ps.map((p) => p.id)]),
    [
      [3, ["p0", "p2"]],
      [5, ["p1"]],
    ],
  );
  assert.equal(favourite(t), 3);
  assert.equal(favourite(tally(votes(3, 5))), null, "one vote each is no favourite");
  assert.equal(favourite(tally(votes(3, 3, 5, 5))), null, "a tie is no favourite");
});

test("the next ticket skips what's played, skipped or on the table, and prefers unpointed ones", () => {
  const q = (key: string, points: number | null = null) => ({ key, points });
  const queue = [q("A-1", 3), q("A-2"), q("A-3"), q("A-4")];
  assert.equal(nextInQueue({ queue, history: [], skipped: [], ticket: null })?.key, "A-2");
  assert.equal(nextInQueue({ queue, history: [{ key: "A-2" }], skipped: ["A-3"], ticket: null })?.key, "A-4");
  assert.equal(nextInQueue({ queue, history: [], skipped: [], ticket: { key: "A-2" } })?.key, "A-3");
  assert.equal(
    nextInQueue({ queue: [q("A-1", 3)], history: [], skipped: [], ticket: null })?.key,
    "A-1",
    "pointed ones still come up last",
  );
  assert.equal(nextInQueue({ queue: [q("A-1")], history: [{ key: "A-1" }], skipped: [], ticket: null }), undefined);
});

test("a card is played as its points, and a card with none as minus its place in the deck", () => {
  const deck = buildDeck({ scale: "tshirt", numbers: [], unsure: true, coffee: true })!;
  assert.deepEqual(playValues(deck), [1, 2, 3, 5, 8, -6, -7]);
  assert.deepEqual(cardValues(deck), [1, 2, 3, 5, 8], "only cards with points can be the final call");
  assert.equal(cardLabel(deck, 3), "M");
  assert.equal(cardLabel(deck, -6), "?");
  assert.equal(cardLabel(deck, -7), "☕");
  assert.equal(cardOf(deck, 13), undefined, "not in this deck");
  assert.equal(cardOf(deck, -1), undefined, "the first card has points: it isn't played as -1");
  assert.equal(cardOf(deck, -9), undefined);
  assert.equal(cardLabel(deck, 13), "13", "a value the deck doesn't know says its number");
  assert.deepEqual([scores(0), scores(8), scores(-6)], [true, true, false]);
});
