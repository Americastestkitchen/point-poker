import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { newTableState } from "../table/state.ts";
import { fileStore } from "./file.ts";
import { memoryStore } from "./memory.ts";

const quiet = { info() {}, error() {} };

test("the file store saves and loads tables", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "pp-store-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const store = fileStore(dir, quiet);
  assert.deepEqual(store.load(), [], "no file yet means no tables");
  const tables = [newTableState("ABCD", "k1", 1), newTableState("WXYZ", "k2", 2)];
  assert.ok(tables[0]);
  tables[0].skipped.push("SD-1");
  store.save(tables);
  assert.deepEqual(fileStore(dir, quiet).load(), tables);
});

test("tables saved in another format are dropped, not half-loaded", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "pp-store-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const good = newTableState("ABCD", "k1", 1);
  // what the old persist.ts wrote: no settings, a Set that became {}
  const old = { ...newTableState("OLDD", "k2", 2), settings: undefined, skipped: {} };
  writeFileSync(join(dir, "rooms.json"), JSON.stringify([good, old]));
  assert.deepEqual(fileStore(dir, quiet).load(), [good]);
  writeFileSync(join(dir, "rooms.json"), "{ not json");
  assert.deepEqual(fileStore(dir, quiet).load(), []);
});

test("tables saved before rooms could change open in the Basement, and so do rooms this server doesn't know", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "pp-store-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const { environment: _, ...before } = newTableState("OLDD", "k1", 1);
  const unknown = { ...newTableState("NEWW", "k2", 2), environment: "moon-base" };
  writeFileSync(join(dir, "rooms.json"), JSON.stringify([before, unknown]));
  const loaded = fileStore(dir, quiet).load();
  assert.deepEqual(
    loaded.map((s) => [s.code, s.environment]),
    [
      ["OLDD", "basement"],
      ["NEWW", "basement"],
    ],
  );
});

test("tables saved mid-reveal before votes could change after it load, and their players can still switch", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "pp-store-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const { revealedVote: _, ...oldPlayer } = {
    id: "p1",
    token: "t1",
    name: "Ann",
    look: { color: "#3bceac", body: "bean", cosmetics: [] },
    seat: 0,
    vote: 3,
    revealedVote: null,
    chips: 0,
    lastWin: 0,
  };
  const before = { ...newTableState("OLDD", "k1", 1), phase: "revealed", players: [oldPlayer] };
  writeFileSync(join(dir, "rooms.json"), JSON.stringify([before]));
  const [loaded] = fileStore(dir, quiet).load();
  assert.equal(loaded?.players[0]?.revealedVote, null);
  assert.equal(loaded?.players[0]?.vote, 3);
});

test("the memory store round-trips through JSON too", () => {
  const store = memoryStore();
  const tables = [newTableState("ABCD", "k", 1)];
  store.save(tables);
  assert.deepEqual(store.load(), tables);
  assert.notEqual(store.load()[0], tables[0]);
});
