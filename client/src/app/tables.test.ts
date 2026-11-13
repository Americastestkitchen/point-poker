import { test } from "node:test";
import assert from "node:assert/strict";
import { createStorage, memoryStorage } from "./storage.ts";
import { createTables, OPEN_FAILED, type FetchLike } from "./tables.ts";

type Reply = { status: number; body?: unknown } | "offline";

function setup(replies: Reply[]) {
  const storage = createStorage(memoryStorage());
  const asked: { url: string; passcode?: string; body?: string }[] = [];
  const fetch: FetchLike = async (url, init) => {
    asked.push({ url, passcode: init?.headers?.["x-host-passcode"], ...(init?.body ? { body: init.body } : {}) });
    const reply = replies.shift();
    if (!reply || reply === "offline") throw new Error("offline");
    return { ok: reply.status < 400, status: reply.status, json: async () => reply.body };
  };
  return { storage, asked, tables: createTables({ fetch, storage }) };
}

test("opening a table remembers the passcode that worked and makes you its dealer", async () => {
  const { tables, storage, asked } = setup([{ status: 200, body: { code: "ABCD", dealerKey: "k-1" } }]);
  assert.deepEqual(await tables.open("hunter2"), { t: "opened", code: "ABCD" });
  assert.deepEqual(asked, [{ url: "/api/rooms", passcode: "hunter2", body: "{}" }]);
  assert.equal(storage.hostPass(), "hunter2");
  assert.equal(storage.dealerKey("ABCD"), "k-1");
  assert.equal(tables.savedPasscode(), "hunter2");
});

test("a missing or wrong passcode asks for one, and forgets nothing", async () => {
  const wrong = { status: 401, body: { error: "Wrong host passcode" } };
  const { tables, storage } = setup([wrong, wrong]);
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
  assert.deepEqual(await tables.check("ABCD"), { t: "open" });
  assert.deepEqual(await tables.check("WXYZ"), { t: "gone" });
  assert.deepEqual(await tables.check("ABCD"), { t: "unknown" });
  assert.deepEqual(await tables.check("ABCD"), { t: "unknown" });
  assert.equal(asked[0]?.url, "/api/rooms/ABCD");
});

test("Jira sign-in: asked for, a site to pick, and the site you picked is sent next time", async () => {
  const sites = [{ id: "c-1", name: "Acme", url: "https://acme.atlassian.net" }];
  const { tables, storage, asked } = setup([
    { status: 401, body: { error: "Sign in with Jira to open a table", signIn: true } },
    { status: 409, body: { error: "Pick a Jira site", sites } },
    { status: 200, body: { code: "ABCD", dealerKey: "k-1" } },
    { status: 200, body: { code: "WXYZ", dealerKey: "k-2" } },
    { status: 403, body: { error: "Your Jira account doesn't have access to acme.atlassian.net." } },
  ]);
  assert.deepEqual(await tables.open(""), { t: "signIn" });
  assert.deepEqual(await tables.open(""), { t: "pickSite", sites });
  assert.deepEqual(await tables.open("", "c-1"), { t: "opened", code: "ABCD" });
  assert.equal(storage.jiraSite(), "c-1");
  assert.deepEqual(await tables.open(""), { t: "opened", code: "WXYZ" });
  assert.equal(asked[3]?.body, JSON.stringify({ site: "c-1" }), "remembered");
  assert.deepEqual(await tables.open(""), {
    t: "failed",
    reason: "Your Jira account doesn't have access to acme.atlassian.net.",
  });
});

test("who's signed in to Jira, and signing out", async () => {
  const { tables, asked } = setup([
    { status: 200, body: { jira: "signIn", user: { name: "Sam" } } },
    { status: 500 },
    { status: 204 },
  ]);
  assert.deepEqual(await tables.host(), { jira: "signIn", user: { name: "Sam" } });
  assert.equal(await tables.host(), null);
  assert.equal(await tables.signOut(), true);
  assert.equal(asked.at(-1)?.url, "/auth/jira/signout");
});
