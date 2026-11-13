// Pins where every body shape's eyes, mouth, shoulders, hat, bow, name tag and
// speech bubble sit today, so beans don't change shape by accident. The
// positions live in anchors.test.ts.snapshot; `npm run test:update-snapshots`
// rewrites it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { BODY_IDS } from "../../../../shared/catalog/bodies.ts";
import { pin } from "../../../../test/pin.ts";
import { anchorsFor } from "./anchors.ts";
import { BODY_SHAPES } from "./index.ts";

test("every body shape keeps its anchors where they are (x, y, z, scale)", async (t) => {
  for (const body of BODY_IDS) {
    await t.test(body, (t) => {
      const anchors = Object.entries(anchorsFor(BODY_SHAPES[body])).map(([name, { x, y, z, s }]) => [name, [x, y, z, s]]);
      pin(t, Object.fromEntries(anchors));
    });
  }
});

test("every catalog body has a shape, filed under its own id", () => {
  for (const id of BODY_IDS) assert.equal(BODY_SHAPES[id].id, id);
});
