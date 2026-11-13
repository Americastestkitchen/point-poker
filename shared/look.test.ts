import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_LOOK, randomLook, validateLook, wear, wornIn } from "./look.ts";

test("a look keeps what's valid and drops the rest", () => {
  assert.deepEqual(validateLook({ color: "#ffd23f", body: "pear", cosmetics: ["crown"] }), { color: "#ffd23f", body: "pear", cosmetics: ["crown"] });
  assert.deepEqual(validateLook({ color: "plaid", body: "blob", cosmetics: ["jetpack"] }), DEFAULT_LOOK);
  assert.deepEqual(validateLook(undefined), DEFAULT_LOOK);
  assert.deepEqual(validateLook({ cosmetics: ["fez", "crown"] }).cosmetics, ["fez"], "one thing per slot");
});

test("wearing something swaps out whatever was in its slot", () => {
  const look = validateLook({ cosmetics: ["fez"] });
  assert.equal(wornIn(look, "head"), "fez");
  assert.deepEqual(wear(look, "head", "crown").cosmetics, ["crown"]);
  assert.deepEqual(wear(look, "head", null).cosmetics, []);
});

test("a random look is a valid one with a hat", () => {
  let n = 0;
  const look = randomLook(() => (n = (n + 0.37) % 1));
  assert.deepEqual(validateLook(look), look);
  assert.ok(wornIn(look, "head"));
});

test("random looks include both ends of each catalog", () => {
  for (const random of [() => 0, () => 1 - Number.EPSILON]) {
    const look = randomLook(random);
    assert.deepEqual(validateLook(look), look);
    assert.ok(wornIn(look, "head"));
  }
});

test("an invalid random source fails instead of producing a partial look", () => {
  for (const value of [-1, 1, NaN, Infinity]) {
    assert.throws(() => randomLook(() => value), /invalid random value/);
  }
});
