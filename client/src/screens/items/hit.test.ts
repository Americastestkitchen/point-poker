import { test } from "node:test";
import assert from "node:assert/strict";
import { ITEM_IDS } from "../../../../shared/catalog/items.ts";
import { HIT_LOOK } from "./hit.ts";

test("everything but pointing shows when it lands on you, and only the hard ones shake the screen", () => {
  assert.equal(HIT_LOOK.point, null);
  assert.deepEqual(
    ITEM_IDS.filter((id) => HIT_LOOK[id]?.shake),
    ["hammer", "chip"],
  );
});
