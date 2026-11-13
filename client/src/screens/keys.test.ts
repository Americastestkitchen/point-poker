import { test } from "node:test";
import assert from "node:assert/strict";
import { menuKeyAllowed, worldKeysAllowed, type KeyState } from "./keys.ts";

const atTable: KeyState = { screen: "table", popup: null, lookOpen: false, dialogOpen: false, focus: "page" };

test("world shortcuts work at the table with nothing over it", () => {
  assert.equal(worldKeysAllowed(atTable), true);
});

test("anything open or focused in the UI keeps world shortcuts off", () => {
  assert.equal(worldKeysAllowed({ ...atTable, screen: "creator" }), false, "not seated yet");
  assert.equal(worldKeysAllowed({ ...atTable, popup: "menu" }), false, "the game menu is open");
  assert.equal(worldKeysAllowed({ ...atTable, lookOpen: true }), false, "the look editor is open");
  assert.equal(worldKeysAllowed({ ...atTable, dialogOpen: true }), false, "a confirm or the copy fallback is open");
  for (const focus of ["control", "field", "dialog"] as const) {
    assert.equal(worldKeysAllowed({ ...atTable, focus }), false, `focus is on a ${focus}`);
  }
});

test("Esc opens the game menu unless a popup, the look editor or a text field has it", () => {
  assert.equal(menuKeyAllowed(atTable), true);
  assert.equal(menuKeyAllowed({ ...atTable, focus: "control" }), true, "a focused top-bar button doesn't stop it");
  assert.equal(menuKeyAllowed({ ...atTable, focus: "field" }), false, "a field cancels with Esc itself");
  assert.equal(menuKeyAllowed({ ...atTable, popup: "leaderboard" }), false, "Esc closes the popup instead");
  assert.equal(menuKeyAllowed({ ...atTable, lookOpen: true }), false);
  assert.equal(menuKeyAllowed({ ...atTable, screen: "start" }), false);
});
