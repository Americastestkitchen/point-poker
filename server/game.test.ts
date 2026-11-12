import { test } from "node:test";
import assert from "node:assert/strict";
import { settle } from "./game.ts";
import { parseIssueKey, adfToText } from "./jira.ts";

test("closest single player takes the whole pot", () => {
  const r = settle(new Map([["a", 2], ["b", 5], ["c", 8]]), 5);
  assert.deepEqual(r, { pot: 15, winners: ["b"], share: 15 });
});

test("ties split the pot, even when equally far on both sides", () => {
  const r = settle(new Map([["a", 3], ["b", 8], ["c", 1]]), 5);
  assert.deepEqual(r.winners, ["a"]);
  const t = settle(new Map([["a", 3], ["b", 3], ["c", 8]]), 5);
  assert.deepEqual(t, { pot: 14, winners: ["a", "b"], share: 7 });
  const s = settle(new Map([["a", 3], ["b", 3]]), 2);
  assert.deepEqual(s, { pot: 6, winners: ["a", "b"], share: 3 });
});

test("you must be within one card of the final call to win", () => {
  assert.deepEqual(settle(new Map([["a", 5]]), 2), { pot: 5, winners: [], share: 0 });
  assert.deepEqual(settle(new Map([["a", 3]]), 2), { pot: 3, winners: ["a"], share: 3 });
  // 2 and 8 are equally far from 5 in points, but only 8 is one card away
  assert.deepEqual(settle(new Map([["a", 2], ["b", 8]]), 5).winners, ["b"]);
  assert.deepEqual(settle(new Map([["a", 1], ["b", 2]]), 8).winners, []);
  // 8 is the top card: a final 8 pays 5 or 8
  assert.deepEqual(settle(new Map([["a", 5], ["b", 3]]), 8).winners, ["a"]);
});

test("uneven splits are rounded to cents", () => {
  const r = settle(new Map([["a", 1], ["b", 1], ["c", 1], ["d", 8]]), 1);
  assert.equal(r.share, 3.67);
});

test("nobody voted means nobody wins", () => {
  assert.deepEqual(settle(new Map(), 5), { pot: 0, winners: [], share: 0 });
});

test("issue keys come out of links and bare keys", () => {
  assert.equal(parseIssueKey("https://x.atlassian.net/browse/SD-1975"), "SD-1975");
  assert.equal(parseIssueKey("https://x.atlassian.net/jira/software/c/projects/SD/boards/1?selectedIssue=SD-42"), "SD-42");
  assert.equal(parseIssueKey(" sd-7 "), "SD-7");
  assert.equal(parseIssueKey("nope"), null);
});

test("ADF flattens to text", () => {
  const doc = { type: "doc", content: [
    { type: "paragraph", content: [{ type: "text", text: "Hello " }, { type: "text", text: "world" }] },
    { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "one" }] }] }] },
  ] };
  assert.equal(adfToText(doc).trim(), "Hello world\n\n• one");
});
