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

test("the memory store round-trips through JSON too", () => {
  const store = memoryStore();
  const tables = [newTableState("ABCD", "k", 1)];
  store.save(tables);
  assert.deepEqual(store.load(), tables);
  assert.notEqual(store.load()[0], tables[0]);
});
