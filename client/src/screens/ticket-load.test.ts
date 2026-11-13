import { test } from "node:test";
import assert from "node:assert/strict";
import { createTicketLoad } from "./ticket-load.ts";

const settle = () => new Promise((r) => setImmediate(r));

function deferred() {
  let resolve!: () => void, reject!: (e: Error) => void;
  const promise = new Promise<void>((y, n) => {
    resolve = y;
    reject = n;
  });
  return { promise, resolve, reject };
}

function setup() {
  const calls: string[] = [];
  const load = createTicketLoad({ openPicker: () => void calls.push("picker"), bonk: () => void calls.push("bonk") });
  return { load, calls };
}

test("loading shows its text, then goes idle when the server answers", async () => {
  const { load, calls } = setup();
  const work = deferred();
  load.run(work.promise, "Dealing the next ticket…");
  assert.deepEqual(load.get(), { status: "loading", text: "Dealing the next ticket…" });
  work.resolve();
  await settle();
  assert.deepEqual(load.get(), { status: "idle" });
  assert.deepEqual(calls, []);
});

test("a failure opens the picker with the reason, and bonks", async () => {
  const { load, calls } = setup();
  load.run(Promise.reject(new Error("SD-9 doesn't exist in Jira")), "Fetching SD-9 from Jira…");
  await settle();
  assert.deepEqual(load.get(), { status: "failed", reason: "SD-9 doesn't exist in Jira" });
  assert.deepEqual(calls, ["picker", "bonk"]);
  load.clear();
  assert.deepEqual(load.get(), { status: "idle" });
});

test("the latest load wins: an older one finishing later changes nothing", async () => {
  const { load, calls } = setup();
  const first = deferred(),
    second = deferred();
  load.run(first.promise, "Fetching SD-1…");
  load.run(second.promise, "Fetching SD-2…");
  first.reject(new Error("too slow"));
  await settle();
  assert.deepEqual(load.get(), { status: "loading", text: "Fetching SD-2…" });
  assert.deepEqual(calls, []);
  second.resolve();
  await settle();
  assert.deepEqual(load.get(), { status: "idle" });
});

test("clearing leaves a load in flight alone, and tells subscribers only on change", () => {
  const { load } = setup();
  let changes = 0;
  load.subscribe(() => changes++);
  load.run(new Promise(() => {}), "Loading this sprint's tickets…");
  load.clear();
  assert.equal(load.get().status, "loading");
  assert.equal(changes, 1);
});
