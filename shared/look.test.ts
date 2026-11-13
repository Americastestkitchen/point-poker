import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_LOOK, randomLook, validateLook, wear, wornIn } from "./look.ts";

test("a look keeps what's valid and drops the rest", () => {
  assert.deepEqual(validateLook({ color: "#ffd23f", body: "pear", cosmetics: ["crown"] }), {
    color: "#ffd23f",
    body: "pear",
    cosmetics: ["crown"],
  });
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

test("face items combine with a hat and each other, one per slot", () => {
  const look = validateLook({ cosmetics: ["crown", "shades", "clown", "walrus", "specs", "beard"] });
  assert.deepEqual(look.cosmetics, ["crown", "shades", "clown", "walrus"]);
  assert.equal(wornIn(look, "eyes"), "shades");
  assert.equal(wornIn(look, "nose"), "clown");
  assert.equal(wornIn(look, "facialHair"), "walrus");
});

test("the disguise fills eyewear and nose together", () => {
  const look = validateLook({ cosmetics: ["specs", "schnoz", "handlebar"] });
  const disguised = wear(look, "nose", "disguise");
  assert.deepEqual(disguised.cosmetics, ["handlebar", "disguise"], "takes off the specs and the schnoz");
  assert.equal(wornIn(disguised, "eyes"), "disguise");
  assert.equal(wornIn(disguised, "nose"), "disguise");
  assert.deepEqual(wear(disguised, "eyes", "monocle").cosmetics, ["handlebar", "monocle"], "and comes off whole");
  assert.deepEqual(wear(disguised, "nose", null).cosmetics, ["handlebar"]);
  assert.deepEqual(validateLook({ cosmetics: ["clown", "disguise"] }).cosmetics, ["clown"], "no room on a clown");
});

test("a look saved before face items keeps its hat and has no face items", () => {
  const look = validateLook({ color: "#ffd23f", body: "pear", cosmetics: ["fez"] });
  assert.deepEqual(look.cosmetics, ["fez"]);
  assert.equal(wornIn(look, "eyes"), null);
});

test("a random look is a valid one with a hat", () => {
  let n = 0;
  const look = randomLook(() => (n = (n + 0.37) % 1));
  assert.deepEqual(validateLook(look), look);
  assert.ok(wornIn(look, "head"));
});

test("random looks sometimes dress the face", () => {
  let n = 0;
  const looks = Array.from({ length: 40 }, () => randomLook(() => (n = (n + 0.137) % 1)));
  for (const look of looks) assert.deepEqual(validateLook(look), look);
  assert.ok(looks.some((l) => l.cosmetics.length > 1));
  assert.ok(looks.some((l) => l.cosmetics.length === 1));
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
