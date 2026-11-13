import { test } from "node:test";
import assert from "node:assert/strict";
import { wrapText } from "./textures.ts";

const measure = { measureText: (text: string) => ({ width: text.length }) };

test("ticket text wraps and truncates the last line in order", () => {
  assert.deepEqual(wrapText(measure, "one two three four five", 7, 3), ["one two", "three", "…"]);
  assert.deepEqual(wrapText(measure, "one two three four five", 7, 2), ["one two", "…"]);
  assert.deepEqual(wrapText(measure, "one two", 7, 1), ["one two"]);
});

test("empty text and a nonpositive line budget produce no lines", () => {
  assert.deepEqual(wrapText(measure, "", 7, 2), []);
  assert.deepEqual(wrapText(measure, "one two three", 7, 0), []);
  assert.deepEqual(wrapText(measure, "one two three", 7, -1), []);
});
