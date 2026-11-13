import { test } from "node:test";
import assert from "node:assert/strict";
import { createDelays } from "./delays.ts";

test("a delay runs once its frame time has passed, and only once", () => {
  const delays = createDelays();
  const ran: string[] = [];
  delays.after(0.3, () => ran.push("slide"));
  delays.after(0.1, () => ran.push("bonk"));
  delays.update(0.1);
  assert.deepEqual(ran, ["bonk"]);
  delays.update(0.1);
  assert.deepEqual(ran, ["bonk"], "0.2s in: the slide still waits");
  delays.update(0.1);
  delays.update(0.1);
  assert.deepEqual(ran, ["bonk", "slide"]);
});

test("no frames, no time: a delay waits for the frame loop", () => {
  const delays = createDelays();
  let ran = false;
  delays.after(1.5, () => (ran = true));
  delays.update(1);
  assert.equal(ran, false);
  delays.update(0.5);
  assert.equal(ran, true);
});

test("a delay scheduled by another starts counting on the next frame", () => {
  const delays = createDelays();
  const ran: string[] = [];
  delays.after(0, () => {
    ran.push("first");
    delays.after(0, () => ran.push("second"));
  });
  delays.update(0.016);
  assert.deepEqual(ran, ["first"]);
  delays.update(0.016);
  assert.deepEqual(ran, ["first", "second"]);
});
