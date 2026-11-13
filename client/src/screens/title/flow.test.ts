import { test } from "node:test";
import assert from "node:assert/strict";
import { noTable, SIGN_IN_FAILED, start, step, type TitleEffect, type TitleEvent, type TitleState } from "./flow.ts";

const menu = (saved: boolean): TitleState => ({ view: { t: "menu" }, saved, invite: null, requests: 0 });

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
    state: { view: { t: "checking", code: "ABCD" }, saved: true, invite: "ABCD", requests: 0 },
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

  assert.deepEqual(run(asked.state, [{ t: "checked", code: "ABCD", open: false }]).view, {
    t: "join",
    checking: null,
    error: noTable("ABCD"),
  });
  assert.deepEqual(run(asked.state, [{ t: "checked", code: "ABCD", open: true }]).effects, [
    { t: "sit", code: "ABCD" },
  ]);
  assert.deepEqual(run(joining, [{ t: "codeEntered", code: "AB" }]).effects, [], "a short code isn't asked about");
});

test("going Back while a typed code is checked: its answer can't sit you down", () => {
  const asked = run(menu(true), [
    { t: "pick", item: "join" },
    { t: "codeEntered", code: "ABCD" },
  ]).state;
  const r = run(asked, [{ t: "back" }, { t: "checked", code: "ABCD", open: true }]);
  assert.deepEqual(r.view, { t: "menu" });
  assert.deepEqual(r.effects, []);
});

test("joining without a profile: character select, whose Back returns to the code", () => {
  const asked = run(menu(false), [
    { t: "pick", item: "join" },
    { t: "codeEntered", code: "ABCD" },
  ]).state;
  const r = run(asked, [{ t: "checked", code: "ABCD", open: true }]);
  assert.equal(r.view.t, "character");
  assert.deepEqual(run(r.state, [{ t: "back" }]).view, { t: "join", checking: null, error: null });
  assert.deepEqual(run(r.state, [{ t: "done" }]).effects, [{ t: "sit", code: "ABCD" }]);
});

test("opening a table: straight away with a profile, through character select without one", () => {
  const r = run(menu(true), [{ t: "pick", item: "open" }]);
  assert.deepEqual(r.view, { t: "opening", sending: true, ask: null, request: 1 });
  assert.deepEqual(r.effects, [{ t: "open", request: 1, passcode: null, site: null }]);
  assert.deepEqual(run(r.state, [{ t: "opened", request: 1, code: "ABCD" }]).effects, [{ t: "sit", code: "ABCD" }]);

  const first = run(menu(false), [{ t: "pick", item: "open" }]);
  assert.equal(first.view.t, "character");
  assert.deepEqual(run(first.state, [{ t: "done" }]).effects, [{ t: "open", request: 1, passcode: null, site: null }]);
  assert.deepEqual(run(first.state, [{ t: "back" }]).view, { t: "menu" }, "Back changes your mind");
});

test("the menu is busy while a table opens: picks wait, and only one open is asked", () => {
  const opening = run(menu(true), [{ t: "pick", item: "open" }]).state;
  const r = run(opening, [
    { t: "pick", item: "join" },
    { t: "pick", item: "open" },
  ]);
  assert.deepEqual(r, { state: opening, view: opening.view, effects: [] });
});

test("the host passcode: asked for, sent once, and a wrong one says so", () => {
  const opening = run(menu(true), [{ t: "pick", item: "open" }]).state;
  const asked = run(opening, [{ t: "passcodeNeeded", request: 1, tried: false }]);
  assert.deepEqual(asked.view, { t: "opening", sending: false, ask: { t: "passcode", wrong: false }, request: 1 });

  const sent = run(asked.state, [{ t: "passcodeEntered", passcode: " hunter2 " }]);
  assert.deepEqual(sent.effects, [{ t: "open", request: 2, passcode: "hunter2", site: null }]);
  assert.deepEqual(run(sent.state, [{ t: "passcodeEntered", passcode: "again" }]).effects, [], "not twice");
  assert.deepEqual(run(asked.state, [{ t: "passcodeEntered", passcode: "  " }]).effects, [], "not blank");

  const wrong = run(sent.state, [{ t: "passcodeNeeded", request: 2, tried: true }]);
  assert.deepEqual(wrong.view, { t: "opening", sending: false, ask: { t: "passcode", wrong: true }, request: 2 });
  assert.deepEqual(run(wrong.state, [{ t: "back" }]).view, { t: "menu" }, "Cancel");
});

test("a failed open says why, once, and a late answer after Cancel does nothing", () => {
  const opening = run(menu(true), [{ t: "pick", item: "open" }]).state;
  const failed = run(opening, [{ t: "openFailed", request: 1, reason: "nope" }]);
  assert.deepEqual(failed.view, { t: "menu" });
  assert.deepEqual(failed.effects, [{ t: "error", text: "nope" }]);
  assert.deepEqual(run(opening, [{ t: "back" }, { t: "opened", request: 1, code: "ABCD" }]).effects, []);
});

test("Cancel, then Open again: the first ask's late answer isn't taken for the second's", () => {
  const second = run(menu(true), [{ t: "pick", item: "open" }, { t: "back" }, { t: "pick", item: "open" }]);
  assert.deepEqual(second.effects.at(-1), { t: "open", request: 2, passcode: null, site: null });
  const late = run(second.state, [{ t: "openFailed", request: 1, reason: "slow no" }]);
  assert.deepEqual(late.view, second.view, "still waiting for the second ask");
  assert.deepEqual(late.effects, []);
  assert.deepEqual(run(late.state, [{ t: "opened", request: 2, code: "WXYZ" }]).effects, [{ t: "sit", code: "WXYZ" }]);
});

test("Character from the menu saves and comes back to the menu", () => {
  const r = run(menu(true), [{ t: "pick", item: "character" }, { t: "done" }]);
  assert.deepEqual(r.view, { t: "menu" });
  assert.deepEqual(r.effects, []);
});

const SITES = [
  { id: "c-1", name: "Acme", url: "https://acme.atlassian.net" },
  { id: "c-2", name: "Side", url: "https://side.atlassian.net" },
];

test("signing in with Jira: asked for, leaves the page once, and Cancel changes your mind", () => {
  const opening = run(menu(true), [{ t: "pick", item: "open" }]).state;
  const asked = run(opening, [{ t: "signInNeeded", request: 1 }]);
  assert.deepEqual(asked.view, { t: "opening", sending: false, ask: { t: "signIn" }, request: 1 });
  const going = run(asked.state, [{ t: "signIn" }]);
  assert.deepEqual(going.effects, [{ t: "signIn" }]);
  assert.equal(going.view.t === "opening" && going.view.sending, true, "the button waits while the page leaves");
  assert.deepEqual(run(asked.state, [{ t: "back" }]).view, { t: "menu" }, "Cancel");
  assert.deepEqual(run(opening, [{ t: "signIn" }]).effects, [], "only once asked");
});

test("back from signing in, the table opens; a sign-in that didn't finish says so on the menu", () => {
  const ok = start("", true, "ok");
  assert.deepEqual(ok.state.view, { t: "opening", sending: true, ask: null, request: 1 });
  assert.deepEqual(ok.effects, [{ t: "open", request: 1, passcode: null, site: null }]);
  assert.deepEqual(start("", true, "failed"), { state: menu(true), effects: [{ t: "error", text: SIGN_IN_FAILED }] });
});

test("more than one Jira site: pick one, and only one that was offered", () => {
  const opening = run(menu(true), [{ t: "pick", item: "open" }]).state;
  const asked = run(opening, [{ t: "sitesOffered", request: 1, sites: SITES }]);
  assert.deepEqual(asked.view, { t: "opening", sending: false, ask: { t: "site", sites: SITES }, request: 1 });
  assert.deepEqual(run(asked.state, [{ t: "siteChosen", site: "nope" }]).effects, []);
  const chosen = run(asked.state, [{ t: "siteChosen", site: "c-2" }]);
  assert.deepEqual(chosen.effects, [{ t: "open", request: 2, passcode: null, site: "c-2" }]);
  assert.deepEqual(run(chosen.state, [{ t: "siteChosen", site: "c-1" }]).effects, [], "not twice");
  assert.deepEqual(run(chosen.state, [{ t: "opened", request: 2, code: "ABCD" }]).effects, [
    { t: "sit", code: "ABCD" },
  ]);
});
