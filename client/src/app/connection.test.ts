import { test } from "node:test";
import assert from "node:assert/strict";
import { nextConnection, type Connection, type ConnectionEvent } from "./connection.ts";

/** Runs events from idle, collecting each state's status and attempt, and each effect. */
function run(...events: ConnectionEvent[]) {
  let c: Connection = { status: "idle" };
  const steps: unknown[] = [];
  for (const e of events) {
    const [next, effect] = nextConnection(c, e, (n) => 100 * 2 ** n);
    c = next;
    steps.push([c.status, "attempt" in c ? c.attempt : "-", effect]);
  }
  return { c, steps };
}

const drop = (code = 1006, reason = ""): ConnectionEvent => ({ t: "dropped", code, reason });

test("joining dials, and an open line says hello", () => {
  assert.deepEqual(run({ t: "join", room: "ABCD" }, { t: "opened" }).steps, [
    ["connecting", 0, { t: "dial" }],
    ["open", "-", { t: "hello" }],
  ]);
});

test("a dropped line redials, backing off until it's open again", () => {
  const { steps } = run({ t: "join", room: "ABCD" }, { t: "opened" }, drop(), drop(), drop(), { t: "opened" }, drop());
  assert.deepEqual(steps.slice(2), [
    ["connecting", 1, { t: "redial", afterMs: 100 }],
    ["connecting", 2, { t: "redial", afterMs: 200 }],
    ["connecting", 3, { t: "redial", afterMs: 400 }],
    ["open", "-", { t: "hello" }],
    ["connecting", 1, { t: "redial", afterMs: 100 }],
  ]);
});

test("being kicked (or a full or missing table) is final", () => {
  const { c, steps } = run({ t: "join", room: "ABCD" }, { t: "opened" }, drop(4001, "Removed by the dealer"), drop(), { t: "opened" });
  assert.deepEqual(c, { status: "closed", room: "ABCD", reason: "Removed by the dealer" });
  assert.deepEqual(steps.slice(3), [["closed", "-", null], ["closed", "-", null]], "nothing brings it back");
});

test("leaving hangs up, even while waiting to redial", () => {
  assert.deepEqual(run({ t: "join", room: "ABCD" }, { t: "opened" }, { t: "leave" }).c, { status: "closed", room: "ABCD", reason: "" });
  const waiting = run({ t: "join", room: "ABCD" }, drop(), { t: "leave" });
  assert.deepEqual(waiting.steps.at(-1), ["closed", "-", { t: "hangUp" }]);
  assert.deepEqual(run({ t: "leave" }).steps, [["idle", "-", null]], "nothing to hang up before joining");
});
