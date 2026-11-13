import { test } from "node:test";
import assert from "node:assert/strict";
import type { OpenResult, TableCheck } from "../../app/tables.ts";
import type { Title } from "../game.tsx";
import { createTitleFlow } from "./runner.ts";

/** A promise you settle by hand, to answer the server's calls in any order. */
function later<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}
const settle = () => new Promise((r) => setImmediate(r));

function setup({ invite = "", saved = true, savedPasscode = "" } = {}) {
  const checks: { code: string; answer: (r: TableCheck) => void }[] = [];
  const opens: { passcode: string; answer: (r: OpenResult) => void }[] = [];
  const sat: string[] = [];
  const errors: string[] = [];
  let forgotten = 0;
  const title: Title = {
    inviteCode: invite,
    tables: {
      savedPasscode: () => savedPasscode,
      check(code) {
        const l = later<TableCheck>();
        checks.push({ code, answer: l.resolve });
        return l.promise;
      },
      open(passcode) {
        const l = later<OpenResult>();
        opens.push({ passcode, answer: l.resolve });
        return l.promise;
      },
    },
    sit: (code) => void sat.push(code),
    forgetInvite: () => void forgotten++,
  };
  const flow = createTitleFlow({ title, saved, error: (text) => void errors.push(text) });
  return { flow, checks, opens, sat, errors, forgotten: () => forgotten };
}

const open = { t: "open", info: { exists: true, jiraEnabled: false, needsPasscode: false } } as const;

test("an invite link is checked once, when the screen first attaches", async () => {
  const { flow, checks } = setup({ invite: "ABCD" });
  assert.equal(checks.length, 0, "nothing until a screen shows it");
  flow.attach();
  flow.detach();
  flow.attach(); // StrictMode mounts twice
  assert.deepEqual(
    checks.map((c) => c.code),
    ["ABCD"],
  );
  checks[0]?.answer(open);
  await settle();
  assert.deepEqual(flow.getState().view, { t: "invite", code: "ABCD" });
});

test("a typed code asked twice is checked once, and its answer sits you down", async () => {
  const { flow, checks, sat } = setup();
  flow.attach();
  flow.dispatch({ t: "pick", item: "join" });
  flow.dispatch({ t: "codeEntered", code: "WXYZ" });
  flow.dispatch({ t: "codeEntered", code: "WXYZ" }); // the 4th letter, then Enter
  assert.equal(checks.length, 1);
  checks[0]?.answer(open);
  await settle();
  assert.deepEqual(sat, ["WXYZ"]);
});

test("Back while a code is checked: the late answer doesn't sit you down", async () => {
  const { flow, checks, sat } = setup();
  flow.attach();
  flow.dispatch({ t: "pick", item: "join" });
  flow.dispatch({ t: "codeEntered", code: "WXYZ" });
  flow.dispatch({ t: "back" });
  checks[0]?.answer(open);
  await settle();
  assert.deepEqual(sat, []);
  assert.deepEqual(flow.getState().view, { t: "menu" });
});

test("a server that can't say whether a table's open: try it anyway", async () => {
  const { flow, checks } = setup({ invite: "ABCD" });
  flow.attach();
  checks[0]?.answer({ t: "unknown" });
  await settle();
  assert.deepEqual(flow.getState().view, { t: "invite", code: "ABCD" });
});

test("opening uses the saved passcode first, then the one you type", async () => {
  const { flow, opens, sat } = setup({ savedPasscode: "old" });
  flow.attach();
  flow.dispatch({ t: "pick", item: "open" });
  assert.equal(opens[0]?.passcode, "old");
  opens[0]?.answer({ t: "passcode", tried: true });
  await settle();
  flow.dispatch({ t: "passcodeEntered", passcode: "new" });
  assert.equal(opens[1]?.passcode, "new");
  opens[1]?.answer({ t: "opened", code: "QRST" });
  await settle();
  assert.deepEqual(sat, ["QRST"]);
});

test("Cancel then Open again: the first ask's late failure is ignored", async () => {
  const { flow, opens, sat, errors } = setup();
  flow.attach();
  flow.dispatch({ t: "pick", item: "open" });
  flow.dispatch({ t: "back" });
  flow.dispatch({ t: "pick", item: "open" });
  opens[0]?.answer({ t: "failed", reason: "slow no" });
  await settle();
  assert.deepEqual(errors, []);
  opens[1]?.answer({ t: "opened", code: "QRST" });
  await settle();
  assert.deepEqual(sat, ["QRST"]);
});

test("a failed open shows its reason; answers after the screen is gone are dropped", async () => {
  const { flow, opens, errors } = setup();
  flow.attach();
  flow.dispatch({ t: "pick", item: "open" });
  opens[0]?.answer({ t: "failed", reason: "no tables today" });
  await settle();
  assert.deepEqual(errors, ["no tables today"]);

  flow.dispatch({ t: "pick", item: "open" });
  flow.detach();
  const before = flow.getState();
  opens[1]?.answer({ t: "failed", reason: "nobody's listening" });
  await settle();
  assert.equal(flow.getState(), before);
  assert.deepEqual(errors, ["no tables today"]);
});

test("a gone invite drops ?room= once; listeners hear each change", async () => {
  const { flow, checks, forgotten } = setup({ invite: "GONE" });
  let heard = 0;
  const stop = flow.subscribe(() => heard++);
  flow.attach();
  checks[0]?.answer({ t: "gone" });
  await settle();
  assert.deepEqual(flow.getState().view, { t: "gone", code: "GONE" });
  assert.equal(forgotten(), 1);
  assert.equal(heard, 1);
  stop();
  flow.dispatch({ t: "back" });
  assert.equal(heard, 1, "unsubscribed");
  assert.equal(forgotten(), 1);
});
