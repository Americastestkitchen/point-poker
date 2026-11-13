import { test } from "node:test";
import assert from "node:assert/strict";
import { names, ticketKind } from "./text.ts";

test("names read like a sentence", () => {
  assert.equal(names([]), "");
  assert.equal(names(["Ann"]), "Ann");
  assert.equal(names(["Ann", "Bob"]), "Ann & Bob");
  assert.equal(names(["Ann", "Bob", "Cat"]), "Ann, Bob & Cat");
});

test("ticket types get their icon, whatever Jira calls them", () => {
  assert.deepEqual(ticketKind("Bug"), { kind: "bug", glyph: "●" });
  assert.deepEqual(ticketKind("Sub-task"), { kind: "task", glyph: "✓" });
  assert.deepEqual(ticketKind("subtask"), { kind: "task", glyph: "✓" });
  assert.deepEqual(ticketKind("Story"), { kind: "story", glyph: "▮" });
  assert.deepEqual(ticketKind("Epic"), { kind: "epic", glyph: "⚡" });
  assert.deepEqual(ticketKind("Spike"), { kind: "other", glyph: "◆" });
  assert.deepEqual(ticketKind(""), { kind: "task", glyph: "✓" }, "a typed-in ticket reads as a task, like before");
});
