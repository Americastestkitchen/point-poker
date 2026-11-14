// The dev site's callback is the one Atlassian sends previews and local runs back to, and it
// passes each sign-in on only to addresses matching ATLASSIAN_RELAY in fly.dev.toml. A typo
// there breaks every preview's sign-in without failing anything else, so it's checked here.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const toml = readFileSync(join(import.meta.dirname, "..", "fly.dev.toml"), "utf8");
const pattern = /^\s*ATLASSIAN_RELAY\s*=\s*'([^']*)'/m.exec(toml)?.[1];

test("the dev site passes sign-ins on to previews and local runs, and nowhere else", () => {
  assert.ok(pattern, "fly.dev.toml sets ATLASSIAN_RELAY");
  const relay = new RegExp(pattern);
  for (const origin of [
    "https://point-poker-pr-42.fly.dev",
    "http://localhost:8787",
    "http://localhost:5173",
    "https://laptop.cat-dog.ts.net",
    "https://laptop.cat-dog.ts.net:10443",
  ])
    assert.ok(relay.test(origin), `passes on to ${origin}`);
  for (const origin of [
    "https://point-poker.fly.dev",
    "https://point-poker-dev.fly.dev",
    "https://point-poker-pr-42.fly.dev.evil.example",
    "https://evil.example",
    "http://point-poker-pr-42.fly.dev",
    "https://localhost:8787",
    "http://localhost.evil.example",
    "http://laptop.cat-dog.ts.net",
    "https://evil.example/.ts.net",
  ])
    assert.ok(!relay.test(origin), `doesn't pass on to ${origin}`);
});
