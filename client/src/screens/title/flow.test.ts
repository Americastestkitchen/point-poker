import { test } from "node:test";
import assert from "node:assert/strict";
import { noTable, start, step, type TitleEffect, type TitleEvent, type TitleState } from "./flow.ts";

const menu = (saved: boolean): TitleState => ({ view: { t: "menu" }, saved, invite: null });

/** Runs `events` from `state`, collecting every effect along the way. */
function run(state: TitleState, events: TitleEvent[]) {
  const effects: TitleEffect[] = [];
  for (const e of events) {
    const s = step(state, e);
    state = s.state;
    effects.push(...s.effects);
  }
  return { state, view: state.view, effects };
}

test("the site opens on the menu; an invite link checks its table first", () => {
  assert.deepEqual(start("", true), { state: menu(true), effects: [] });
  assert.deepEqual(start("ABCD", true), {
    state: { view: { t: "checking", code: "ABCD" }, saved: true, invite: "ABCD" },
    effects: [{ t: "check", code: "ABCD" }],
  });
});

test("an invite with a saved profile is one click; without one, character select then sit", () => {
  const saved = run(start("ABCD", true).state, [{ t: "checked", code: "ABCD", open: true }]);
  assert.deepEqual(saved.view, { t: "invite", code: "ABCD" });
  assert.deepEqual(saved.effects, [], "the invite stays in the address bar while you look at it");
  assert.deepEqual(run(saved.state, [{ t: "joinInvite" }]).effects, [{ t: "sit", code: "ABCD" }]);

  const fresh = run(start("ABCD", false).state, [{ t: "checked", code: "ABCD", open: true }, { t: "done" }]);
  assert.deepEqual(fresh.effects, [{ t: "sit", code: "ABCD" }]);
  assert.equal(fresh.state.saved, true);
});

test("Back from a first-time invite's character select goes to the menu and drops the invite", () => {
  const r = run(start("ABCD", false).state, [{ t: "checked", code: "ABCD", open: true }, { t: "back" }]);
  assert.deepEqual(r.view, { t: "menu" });
  assert.deepEqual(r.effects, [{ t: "forgetInvite" }]);
  assert.equal(r.state.invite, null);
});

test("change look from an invite comes back to the invite", () => {
  const invite = run(start("ABCD", true).state, [{ t: "checked", code: "ABCD", open: true }]).state;
  const changed = run(invite, [{ t: "changeLook" }, { t: "done" }]);
  assert.deepEqual(changed.view, invite.view);
  assert.deepEqual(changed.effects, [], "saving your look doesn't sit you down");
  assert.deepEqual(run(invite, [{ t: "changeLook" }, { t: "back" }]).view, invite.view);
});

test("an invite to a closed table says so, drops the invite, and Back goes to the menu", () => {
  const gone = run(start("WXYZ", true).state, [{ t: "checked", code: "WXYZ", open: false }]);
  assert.deepEqual(gone.view, { t: "gone", code: "WXYZ" });
  assert.deepEqual(gone.effects, [{ t: "forgetInvite" }]);
  const back = run(gone.state, [{ t: "back" }]);
  assert.deepEqual(back.view, { t: "menu" });
  assert.deepEqual(back.effects, [], "the invite is only forgotten once");
});

test("a stale check for another code changes nothing", () => {
  const { state } = start("ABCD", true);
  assert.deepEqual(step(state, { t: "checked", code: "WXYZ", open: false }), { state, effects: [] });
});

test("joining by code: asks once, says why a closed table failed, sits you at an open one", () => {
  const joining = run(menu(true), [{ t: "pick", item: "join" }]).state;
  assert.deepEqual(joining.view, { t: "join", checking: null, error: null });

  const asked = run(joining, [{ t: "codeEntered", code: "ABCD" }]);
  assert.deepEqual(asked.effects, [{ t: "check", code: "ABCD" }]);
  assert.deepEqual(
    run(asked.state, [{ t: "codeEntered", code: "ABCD" }]).effects,
    [],
    "the 4th letter and Enter ask once",
  );

  assert.deepEqual(run(asked.state, [{ t: "codeChecked", code: "ABCD", open: false }]).view, {
    t: "join",
    checking: null,
    error: noTable("ABCD"),
  });
  assert.deepEqual(run(asked.state, [{ t: "codeChecked", code: "ABCD", open: true }]).effects, [
    { t: "sit", code: "ABCD" },
  ]);
  assert.deepEqual(run(joining, [{ t: "codeEntered", code: "AB" }]).effects, [], "a short code isn't asked about");
});

test("going Back while a typed code is checked: its answer can't sit you down", () => {
  const asked = run(menu(true), [
    { t: "pick", item: "join" },
    { t: "codeEntered", code: "ABCD" },
  ]).state;
  const r = run(asked, [{ t: "back" }, { t: "codeChecked", code: "ABCD", open: true }]);
  assert.deepEqual(r.view, { t: "menu" });
  assert.deepEqual(r.effects, []);
});

test("joining without a profile: character select, whose Back returns to the code", () => {
  const asked = run(menu(false), [
    { t: "pick", item: "join" },
    { t: "codeEntered", code: "ABCD" },
  ]).state;
  const r = run(asked, [{ t: "codeChecked", code: "ABCD", open: true }]);
  assert.equal(r.view.t, "character");
  assert.deepEqual(run(r.state, [{ t: "back" }]).view, { t: "join", checking: null, error: null });
  assert.deepEqual(run(r.state, [{ t: "done" }]).effects, [{ t: "sit", code: "ABCD" }]);
});

test("opening a table: straight away with a profile, through character select without one", () => {
  const r = run(menu(true), [{ t: "pick", item: "open" }]);
  assert.deepEqual(r.view, { t: "opening", sending: true, passcode: null });
  assert.deepEqual(r.effects, [{ t: "open", passcode: null }]);
  assert.deepEqual(run(r.state, [{ t: "opened", code: "ABCD" }]).effects, [{ t: "sit", code: "ABCD" }]);

  const first = run(menu(false), [{ t: "pick", item: "open" }]);
  assert.equal(first.view.t, "character");
  assert.deepEqual(run(first.state, [{ t: "done" }]).effects, [{ t: "open", passcode: null }]);
  assert.deepEqual(run(first.state, [{ t: "back" }]).view, { t: "menu" }, "Back changes your mind");
});

test("the menu is busy while a table opens: picks wait, and only one open is asked", () => {
  const opening = run(menu(true), [{ t: "pick", item: "open" }]).state;
  assert.deepEqual(
    run(opening, [
      { t: "pick", item: "join" },
      { t: "pick", item: "open" },
    ]),
    {
      state: opening,
      view: opening.view,
      effects: [],
    },
  );
});

test("the host passcode: asked for, sent once, and a wrong one says so", () => {
  const opening = run(menu(true), [{ t: "pick", item: "open" }]).state;
  const asked = run(opening, [{ t: "passcodeNeeded", tried: false }]);
  assert.deepEqual(asked.view, { t: "opening", sending: false, passcode: { wrong: false } });

  const sent = run(asked.state, [{ t: "passcodeEntered", passcode: " hunter2 " }]);
  assert.deepEqual(sent.effects, [{ t: "open", passcode: "hunter2" }]);
  assert.deepEqual(run(sent.state, [{ t: "passcodeEntered", passcode: "again" }]).effects, [], "not twice");
  assert.deepEqual(run(asked.state, [{ t: "passcodeEntered", passcode: "  " }]).effects, [], "not blank");

  const wrong = run(sent.state, [{ t: "passcodeNeeded", tried: true }]);
  assert.deepEqual(wrong.view, { t: "opening", sending: false, passcode: { wrong: true } });
  assert.deepEqual(run(wrong.state, [{ t: "back" }]).view, { t: "menu" }, "Cancel");
});

test("a failed open says why, once, and a late answer after Cancel does nothing", () => {
  const opening = run(menu(true), [{ t: "pick", item: "open" }]).state;
  const failed = run(opening, [{ t: "openFailed", reason: "nope" }]);
  assert.deepEqual(failed.view, { t: "menu" });
  assert.deepEqual(failed.effects, [{ t: "error", text: "nope" }]);
  assert.deepEqual(run(opening, [{ t: "back" }, { t: "opened", code: "ABCD" }]).effects, []);
});

test("Character from the menu saves and comes back to the menu", () => {
  const r = run(menu(true), [{ t: "pick", item: "character" }, { t: "done" }]);
  assert.deepEqual(r.view, { t: "menu" });
  assert.deepEqual(r.effects, []);
});
