import { test } from "node:test";
import assert from "node:assert/strict";
import { createBackStack } from "./back.ts";
import { direction, intentOf } from "./intent.ts";
import { countAt, fraction, snap, valueAt } from "./range.ts";
import { first, step } from "./roving.ts";
import { cursorOf, normalize, typeInto } from "./slots.ts";

test("keys become intents; shortcuts are left alone", () => {
  assert.equal(intentOf({ key: "ArrowUp" }), "up");
  assert.equal(intentOf({ key: "Enter" }), "confirm");
  assert.equal(intentOf({ key: " " }), "confirm");
  assert.equal(intentOf({ key: "Escape" }), "back");
  assert.equal(intentOf({ key: "a" }), null);
  assert.equal(intentOf({ key: "ArrowLeft", metaKey: true }), null, "⌘← is the browser's");
});

test("a list only moves along its own axis", () => {
  assert.equal(direction("down", "vertical"), 1);
  assert.equal(direction("left", "vertical"), 0);
  assert.equal(direction("left", "horizontal"), -1);
  assert.equal(direction("confirm", "horizontal"), 0);
});

test("focus steps through a list, wrapping and skipping what's disabled", () => {
  assert.equal(step(0, 3, 1), 1);
  assert.equal(step(2, 3, 1), 0, "wraps past the end");
  assert.equal(step(0, 3, -1), 2, "wraps past the start");
  assert.equal(step(2, 3, 1, { wrap: false }), 2, "stays put without wrap");
  assert.equal(step(0, 4, 1, { disabled: (i) => i === 1 || i === 2 }), 3);
  assert.equal(step(-1, 3, 1), 0, "nothing focused: down starts at the top");
  assert.equal(step(-1, 3, -1), 2, "nothing focused: up starts at the bottom");
  assert.equal(step(1, 3, 1, { disabled: () => true }), 1, "nowhere to go");
  assert.equal(step(0, 0, 1), -1);
  assert.equal(first(3, (i) => i === 0), 1);
});

test("Esc closes whatever opened last, and nothing when nothing's open", () => {
  const back = createBackStack();
  const closed: string[] = [];
  assert.equal(back.back(), false);
  const popMenu = back.push(() => closed.push("menu"));
  const popDialog = back.push(() => closed.push("dialog"));
  assert.equal(back.back(), true);
  assert.deepEqual(closed, ["dialog"]);
  popDialog();
  back.back();
  assert.deepEqual(closed, ["dialog", "menu"]);
  popMenu();
  assert.equal(back.depth, 0);
  popMenu(); // twice is harmless
  assert.equal(back.depth, 0);
});

test("Esc goes to the deepest thing first, whatever order they registered in", () => {
  const back = createBackStack();
  const closed: string[] = [];
  // React runs a child's effects before its parent's, so a nested dialog registers first
  const popNested = back.push(() => closed.push("nested"), 2);
  back.push(() => closed.push("outer"), 1);
  back.back();
  assert.deepEqual(closed, ["nested"]);
  popNested();
  back.back();
  assert.deepEqual(closed, ["nested", "outer"]);
});

test("something that can't be closed still takes Esc, so what's under it stays open", () => {
  const back = createBackStack();
  const closed: string[] = [];
  back.push(() => closed.push("leave?"), 1);
  const popMust = back.push(() => {}, 1); // a must-answer dialog, opened later
  assert.equal(back.back(), true, "Esc is used up");
  assert.deepEqual(closed, []);
  popMust();
  back.back();
  assert.deepEqual(closed, ["leave?"]);
});

test("code slots keep letters only, uppercased, up to the length", () => {
  assert.equal(typeInto("", "ab", 4), "AB");
  assert.equal(typeInto("AB", "c-d9e", 4), "ABCD", "drops other characters and overflow");
  assert.equal(normalize(" xq zt ", 4), "XQZT", "a pasted code with spaces");
  assert.equal(typeInto("", "12", 4, "0123456789"), "12", "another alphabet");
  assert.equal(cursorOf("AB", 4), 2);
  assert.equal(cursorOf("ABCD", 4), 4);
});

test("sliders snap to their step and stay in range", () => {
  const r = { min: 0, max: 1, step: 0.1 };
  assert.equal(snap(0.34, r), 0.3);
  assert.equal(snap(0.1 + 0.2, r), 0.3, "no floating point drift");
  assert.equal(snap(2, r), 1);
  assert.equal(snap(-1, r), 0);
  assert.equal(valueAt(150, 100, 200, r), 0.3, "a quarter along the track, snapped");
  assert.equal(valueAt(0, 100, 200, r), 0, "left of the track");
  assert.equal(fraction(5, { min: 0, max: 10, step: 1 }), 0.5);
});

test("the coin counter rolls from the old value to the new one", () => {
  assert.equal(countAt(100, 200, 0), 100);
  assert.equal(countAt(100, 200, 1), 200);
  assert.equal(countAt(100, 200, 5), 200, "clamped");
  assert.ok(countAt(100, 200, 0.5) > 150, "eases out: most of the way by halfway");
  assert.equal(countAt(200, 100, 1), 100, "counts down too");
  assert.equal(countAt(3, 6.5, 1), 6.5, "a split pot's half coin is where it stops");
  assert.equal(countAt(3, 6.5, 0.5), Math.round(countAt(3, 6.5, 0.5)), "whole numbers on the way");
});
