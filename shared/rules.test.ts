import { test } from "node:test";
import assert from "node:assert/strict";
import { allIn, favourite, nextInQueue, parseIssueKey, tally, voters } from "./rules.ts";

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
