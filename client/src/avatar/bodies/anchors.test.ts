// Pins every body shape's anchors to where main put the eyes, mouth,
// shoulders, hats and labels, so the rig keeps beans looking exactly the same.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BODY_IDS } from "../../../../shared/catalog/bodies.ts";
import { anchorsFor } from "./anchors.ts";
import { BODY_SHAPES } from "./index.ts";

const pinned: Record<string, Record<string, number[]>> = JSON.parse(readFileSync(join(import.meta.dirname, "anchors.pinned.json"), "utf8"));

test("every body shape keeps its face, arms, hat and labels where they were", () => {
  for (const body of BODY_IDS) {
    const a = anchorsFor(BODY_SHAPES[body]) as Record<string, { x: number; y: number; z: number; s: number }>;
    for (const [name, expected] of Object.entries(pinned[body])) {
      const { x, y, z, s } = a[name];
      [x, y, z, s].forEach((v, i) => assert.ok(Math.abs(v - expected[i]) < 1e-9, `${body} ${name}: ${[x, y, z, s]} vs ${expected}`));
    }
  }
  assert.deepEqual(Object.keys(pinned).filter((k) => !k.startsWith("_")).sort(), [...BODY_IDS].sort());
});

test("every catalog body has a shape, filed under its own id", () => {
  for (const id of BODY_IDS) assert.equal(BODY_SHAPES[id].id, id);
});
