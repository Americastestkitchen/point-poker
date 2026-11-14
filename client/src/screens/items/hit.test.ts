import { test } from "node:test";
import assert from "node:assert/strict";
import { ITEM_IDS } from "../../../../shared/catalog/items.ts";
import { HIT_LOOK, splatAt } from "./hit.ts";

test("everything but pointing shows when it lands on you, and only the hard ones shake the screen", () => {
  assert.equal(HIT_LOOK.point, null);
  assert.deepEqual(
    ITEM_IDS.filter((id) => HIT_LOOK[id]?.shake),
    ["hammer", "coin"],
  );
  assert.deepEqual(
    ITEM_IDS.filter((id) => HIT_LOOK[id]?.splat),
    ["spitball"],
  );
});

test("a spitball lands in the upper half of the screen, clear of your cards", () => {
  for (const r of [0, 0.25, 0.5, 0.999]) {
    const s = splatAt(() => r);
    assert.ok(s.x >= 0 && s.x <= 100);
    assert.ok(s.y >= 0 && s.y + (s.size / 2 / 600) * 100 < 60, `a splat at ${s.y}% stays above the dock`);
  }
});
