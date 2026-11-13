import { test } from "node:test";
import assert from "node:assert/strict";
import { editProfile, readyToSit, type ProfileAction } from "./profile.ts";
import type { Profile } from "./storage.ts";

const start: Profile = { name: "", look: { color: "#ff6b4a", body: "bean", cosmetics: ["fez"] } };
const run = (...actions: ProfileAction[]) => actions.reduce(editProfile, start);

test("each pick changes just that part of you", () => {
  assert.deepEqual(run({ t: "name", name: "Ann" }, { t: "color", color: "#3bceac" }, { t: "body", body: "pear" }), {
    name: "Ann",
    look: { color: "#3bceac", body: "pear", cosmetics: ["fez"] },
  });
});

test("a new hat swaps out the old one, and none takes it off", () => {
  assert.deepEqual(run({ t: "wear", slot: "head", id: "crown" }).look.cosmetics, ["crown"]);
  assert.deepEqual(run({ t: "wear", slot: "head", id: null }).look.cosmetics, []);
});

test("you can sit down once you have a name, trimmed", () => {
  assert.equal(readyToSit(start), null);
  assert.equal(readyToSit(run({ t: "name", name: "   " })), null, "spaces aren't a name");
  assert.equal(readyToSit(run({ t: "name", name: "  Ann " }))?.name, "Ann");
});
