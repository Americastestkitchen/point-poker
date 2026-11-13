import { test } from "node:test";
import assert from "node:assert/strict";
import { createStorage, memoryStorage } from "./storage.ts";
import { createTables, OPEN_FAILED, type FetchLike } from "./tables.ts";

type Reply = { status: number; body?: unknown } | "offline";

function setup(replies: Reply[]) {
  const storage = createStorage(memoryStorage());
  const asked: { url: string; passcode?: string }[] = [];
  const fetch: FetchLike = async (url, init) => {
    asked.push({ url, passcode: init?.headers?.["x-host-passcode"] });
    const reply = replies.shift();
    if (!reply || reply === "offline") throw new Error("offline");
    return { ok: reply.status < 400, status: reply.status, json: async () => reply.body };
  };
  return { storage, asked, tables: createTables({ fetch, storage }) };
}

test("opening a table remembers the passcode that worked and makes you its dealer", async () => {
  const { tables, storage, asked } = setup([{ status: 200, body: { code: "ABCD", dealerKey: "k-1" } }]);
  assert.deepEqual(await tables.open("hunter2"), { t: "opened", code: "ABCD" });
  assert.deepEqual(asked, [{ url: "/api/rooms", passcode: "hunter2" }]);
  assert.equal(storage.hostPass(), "hunter2");
  assert.equal(storage.dealerKey("ABCD"), "k-1");
  assert.equal(tables.savedPasscode(), "hunter2");
});

test("a missing or wrong passcode asks for one, and forgets nothing", async () => {
  const { tables, storage } = setup([{ status: 401 }, { status: 401 }]);
  storage.setHostPass("old");
  assert.deepEqual(await tables.open(""), { t: "passcode", tried: false });
  assert.deepEqual(await tables.open("nope"), { t: "passcode", tried: true });
  assert.equal(storage.hostPass(), "old");
});

test("a server error, a bad reply or no network is a failure with a reason", async () => {
  const { tables } = setup([{ status: 500 }, { status: 200, body: { code: 7 } }, "offline"]);
  for (let i = 0; i < 3; i++) assert.deepEqual(await tables.open(""), { t: "failed", reason: OPEN_FAILED });
});

test("checking an invite: open, gone, or we couldn't tell", async () => {
  const info = { exists: true, jiraEnabled: false, needsPasscode: true };
  const { tables, asked } = setup([
    { status: 200, body: info },
    { status: 404, body: { ...info, exists: false } },
    { status: 502, body: "<html>" },
    "offline",
  ]);
  assert.deepEqual(await tables.check("ABCD"), { t: "open", info });
  assert.deepEqual(await tables.check("WXYZ"), { t: "gone" });
  assert.deepEqual(await tables.check("ABCD"), { t: "unknown" });
  assert.deepEqual(await tables.check("ABCD"), { t: "unknown" });
  assert.equal(asked[0]?.url, "/api/rooms/ABCD");
});
