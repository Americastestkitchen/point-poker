import { test } from "node:test";
import assert from "node:assert/strict";
import { fitDistance, viewportOf } from "./showcase.ts";

test("a box from the top-left becomes a viewport from the bottom-left", () => {
  assert.deepEqual(viewportOf({ x: 40, y: 100, width: 300, height: 400 }, 900), {
    x: 40,
    y: 400,
    width: 300,
    height: 400,
  });
  assert.deepEqual(viewportOf({ x: 0, y: 0, width: 10, height: 900 }, 900).y, 0, "a full-height box starts at 0");
});

test("the camera backs off for narrow boxes and stays put once height is what limits it", () => {
  const tall = fitDistance(0.4);
  const square = fitDistance(1);
  const wide = fitDistance(3);
  assert.ok(tall > square, "a narrow box needs more distance to fit the bean's width");
  assert.equal(fitDistance(4), wide, "past a point, only the height matters");
  assert.ok(square > 0);
});
