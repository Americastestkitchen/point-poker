import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDeck } from "../../../shared/catalog/decks.ts";
import type { HouseRules } from "../../../shared/protocol.ts";
import { view } from "./fixtures.ts";
import { rememberHouseRules, rulesOf } from "./house-rules.ts";
import { createStore } from "./store.ts";

function setup(meId: string) {
  const store = createStore();
  const saved: HouseRules[] = [];
  rememberHouseRules(store, { setHouseRules: (rules) => void saved.push(rules) });
  store.welcomed(meId);
  return { store, saved };
}

test("the rules of the table you deal are saved when they change, and only then", () => {
  const { store, saved } = setup("deb");
  store.receive(view());
  assert.deepEqual(saved, [rulesOf(view())]);
  store.receive(view({ round: 3 }));
  assert.equal(saved.length, 1, "a view with the same rules saves nothing");
  const sizes = buildDeck({ scale: "tshirt", numbers: [], unsure: true, coffee: false })!;
  store.receive(view({ environment: "diner", settings: { deck: sizes, dealerPlays: true, environment: "basement" } }));
  assert.deepEqual(saved.at(-1), {
    deck: { scale: "tshirt", numbers: [], unsure: true, coffee: false },
    dealerPlays: true,
    environment: "diner",
  });
});

test("a player's browser remembers nothing about someone else's table", () => {
  const { store, saved } = setup("ann");
  store.receive(view());
  assert.deepEqual(saved, []);
});
