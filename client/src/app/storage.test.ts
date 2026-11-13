import { test } from "node:test";
import assert from "node:assert/strict";
import { createStorage, memoryStorage } from "./storage.ts";

const look = { color: "#3bceac", body: "pear", cosmetics: ["fez"] } as const;

test("your profile comes back as you saved it", () => {
  const storage = createStorage(memoryStorage());
  assert.deepEqual(storage.profile(), {});
  storage.setProfile({ name: "Ann", look: { ...look, cosmetics: [...look.cosmetics] } });
  assert.deepEqual(storage.profile(), { name: "Ann", look });
});

test("a damaged profile keeps whichever parts still read", () => {
  const raw = memoryStorage();
  const storage = createStorage(raw);
  raw.setItem("pp-me", JSON.stringify({ name: "Ann", look: { color: "plaid" } }));
  assert.deepEqual(storage.profile(), { name: "Ann", look: undefined });
  raw.setItem("pp-me", JSON.stringify({ name: 7, look }));
  assert.deepEqual(storage.profile(), { name: undefined, look });
  for (const junk of ["{nope", "null", "5", "[]"]) {
    raw.setItem("pp-me", junk);
    assert.deepEqual(storage.profile(), {}, junk);
  }
});
