import { test } from "node:test";
import assert from "node:assert/strict";
import { start, step, type Event, type View } from "./flow.ts";

/** Runs `events` from `view`, collecting the side effects along the way. */
function run(view: View, events: Event[], hasProfile: boolean) {
  const effects: unknown[] = [];
  for (const e of events) {
    const s = step(view, e, hasProfile);
    view = s.view;
    if (s.go) effects.push(s.go);
  }
  return { view, effects };
}

test("the site opens on the menu; an invite link checks its table first", () => {
  assert.deepEqual(start(""), { t: "menu" });
  assert.deepEqual(start("ABCD"), { t: "checking", code: "ABCD" });
});

test("opening a table: straight away with a profile, through character select without one", () => {
  assert.deepEqual(run({ t: "menu" }, [{ t: "pick", item: "open" }], true).effects, [{ t: "open" }]);

  const first = run({ t: "menu" }, [{ t: "pick", item: "open" }], false);
  assert.equal(first.view.t, "character");
  assert.deepEqual(first.effects, []);
  assert.deepEqual(run(first.view, [{ t: "done" }], true).effects, [{ t: "open" }]);
  assert.deepEqual(run(first.view, [{ t: "back" }], false).view, { t: "menu" }, "Back changes your mind");
});

test("an invite with a saved profile is one click; without one, character select then sit", () => {
  const saved = run(start("ABCD"), [{ t: "checked", code: "ABCD", open: true }], true);
  assert.deepEqual(saved.view, { t: "invite", code: "ABCD" });
  assert.deepEqual(run(saved.view, [{ t: "joinInvite" }], true).effects, [{ t: "sit", code: "ABCD" }]);

  const fresh = run(start("ABCD"), [{ t: "checked", code: "ABCD", open: true }, { t: "done" }], false);
  assert.deepEqual(fresh.effects, [{ t: "sit", code: "ABCD" }]);
});

test("change look from an invite comes back to the invite", () => {
  const view: View = { t: "invite", code: "ABCD" };
  const changed = run(view, [{ t: "changeLook" }, { t: "done" }], true);
  assert.deepEqual(changed.view, view);
  assert.deepEqual(changed.effects, [], "saving your look doesn't sit you down");
  assert.deepEqual(run(view, [{ t: "changeLook" }, { t: "back" }], true).view, view);
});

test("an invite to a closed table says so and goes back to the menu", () => {
  const gone = run(start("WXYZ"), [{ t: "checked", code: "WXYZ", open: false }], true);
  assert.deepEqual(gone.view, { t: "gone", code: "WXYZ" });
  assert.deepEqual(run(gone.view, [{ t: "back" }], true).view, { t: "menu" });
});

test("a stale check for another code changes nothing", () => {
  const view = start("ABCD");
  assert.deepEqual(step(view, { t: "checked", code: "WXYZ", open: false }, true), { view, go: null });
});

test("joining by code: a closed table says why and stays; an open one sits you down", () => {
  const joining = run({ t: "menu" }, [{ t: "pick", item: "join" }], true).view;
  assert.deepEqual(joining, { t: "join", error: null });
  assert.deepEqual(run(joining, [{ t: "joinTyped", code: "QQQQ", open: false }], true).view, {
    t: "join",
    error: "There's no table QQQQ open.",
  });
  assert.deepEqual(run(joining, [{ t: "joinTyped", code: "ABCD", open: true }], true).effects, [
    { t: "sit", code: "ABCD" },
  ]);
  const fresh = run(joining, [{ t: "joinTyped", code: "ABCD", open: true }], false);
  assert.equal(fresh.view.t, "character");
  assert.deepEqual(run(fresh.view, [{ t: "back" }], false).view, joining, "Back returns to the code");
  assert.deepEqual(run(joining, [{ t: "back" }], true).view, { t: "menu" });
});

test("Character from the menu saves and comes back to the menu", () => {
  const r = run({ t: "menu" }, [{ t: "pick", item: "character" }, { t: "done" }], true);
  assert.deepEqual(r, { view: { t: "menu" }, effects: [] });
});
