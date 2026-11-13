import { test } from "node:test";
import assert from "node:assert/strict";
import { player, ticket, view } from "../../app/fixtures.ts";
import { kickConfirm, othersOf, playerState, roundActions, skipPlan } from "./panel.ts";
import { BAD_KEY, jiraSubmit, manualSubmit, MAX_DOTS, pasteSubmits, peopleLine, pickerCue, pickerErrors, pickerSections, queueRows, type PickerCue } from "./picker.ts";

const q = (key: string, points: number | null = null) => ({ key, summary: `About ${key}`, points, status: "To Do" });
const result = (key: string) => ({ key, summary: "", finalPoints: 3, pot: 0, winners: [], share: 0 });

// ---------------------------------------------------------------- the panel

test("round actions are only live while voting or revealed; picking a ticket always is", () => {
  const enabled = (phase: "waiting" | "voting" | "revealed" | "settled") =>
    roundActions(view({ phase })).map((a) => `${a.id}:${a.enabled}`).join(" ");
  assert.equal(enabled("waiting"), "restart:false skip:false cancel:false pick:true");
  assert.equal(enabled("voting"), "restart:true skip:true cancel:true pick:true");
  assert.equal(enabled("revealed"), "restart:true skip:true cancel:true pick:true");
  assert.equal(enabled("settled"), "restart:false skip:false cancel:false pick:true");
  assert.deepEqual(roundActions(view()).filter((a) => a.danger).map((a) => a.id), ["cancel"]);
});

test("skip says which ticket comes next, and waits for it like a load; with none queued it just skips", () => {
  const queued = view({ phase: "voting", ticket: ticket("SD-1"), queue: [q("SD-1"), q("SD-2", 3), q("SD-3")] });
  assert.equal(roundActions(queued).find((a) => a.id === "skip")?.sub, "no payout · next SD-3", "the next one without points goes first");
  assert.deepEqual(skipPlan(queued), { t: "load", text: "Skipping to SD-3…" });

  const alone = view({ phase: "voting", ticket: ticket("SD-1") });
  assert.equal(roundActions(alone).find((a) => a.id === "skip")?.sub, "no payout");
  assert.deepEqual(skipPlan(alone), { t: "do" });
});

test("a player's state: away beats everything; voted or thinking only while voting", () => {
  assert.equal(playerState({ connected: false, hasVoted: true }, "voting"), "away");
  assert.equal(playerState({ connected: true, hasVoted: true }, "voting"), "✓ voted");
  assert.equal(playerState({ connected: true, hasVoted: false }, "voting"), "thinking…");
  assert.equal(playerState({ connected: true, hasVoted: true }, "revealed"), "");
  assert.equal(playerState({ connected: true, hasVoted: false }, "waiting"), "");
});

test("the players list leaves out the dealer, wherever the role sits", () => {
  assert.deepEqual(othersOf(view().players).map((p) => p.id), ["ann", "bob"]);
  assert.deepEqual(othersOf([player("ann", { isDealer: true }), player("deb")]).map((p) => p.id), ["deb"]);
  assert.deepEqual(othersOf([player("deb", { isDealer: true })]), []);
  assert.equal(kickConfirm("ANN").title, "Kick ANN from the table?");
});

// ---------------------------------------------------------------- the picker

test("the Jira part shows only with Jira; typing a ticket in is always open without it", () => {
  assert.deepEqual(pickerSections({ jiraEnabled: true }), { jira: true, manual: "collapsible" });
  assert.deepEqual(pickerSections({ jiraEnabled: false }), { jira: false, manual: "always" });
});

test("queue rows: done, skipped, points or nothing; played ones dimmed; the current one marked", () => {
  const room = view({
    ticket: ticket("SD-2"), queueLabel: "Epic SD-9", skipped: ["SD-3"], history: [result("SD-1")],
    queue: [q("SD-1"), q("SD-2"), q("SD-3"), q("SD-4", 5), q("SD-5")],
  });
  const got = queueRows(room);
  assert.equal(got?.title, "Epic SD-9 · tap one to deal it");
  assert.deepEqual(got?.rows.map((r) => [r.key, r.note, r.played, r.current]), [
    ["SD-1", "✓ done", true, false],
    ["SD-2", "", false, true],
    ["SD-3", "skipped", true, false],
    ["SD-4", "5 pts", false, false],
    ["SD-5", "", false, false],
  ]);
  assert.equal(got?.rows[3]?.summary, "About SD-4");
});

test("no queue, no queue section; a queue without a label still reads", () => {
  assert.equal(queueRows(view()), null);
  assert.equal(queueRows(view({ queue: [q("SD-1")] }))?.title, "Lined up · tap one to deal it");
});

test("submitting the Jira field: empty refocuses, junk explains, a link or key loads as typed", () => {
  assert.deepEqual(jiraSubmit("   "), { t: "empty" });
  assert.deepEqual(jiraSubmit("hello there"), { t: "invalid", error: BAD_KEY });
  assert.deepEqual(jiraSubmit(" sd-1234 "), { t: "load", ref: "sd-1234", text: "Fetching SD-1234 from Jira…" });
  const link = "https://acme.atlassian.net/browse/SD-77?focused=1";
  assert.deepEqual(jiraSubmit(link), { t: "load", ref: link, text: "Fetching SD-77 from Jira…" });
});

test("a paste deals at once only when it's a link or key", () => {
  assert.equal(pasteSubmits("https://acme.atlassian.net/browse/SD-77"), true);
  assert.equal(pasteSubmits("SD-1"), true);
  assert.equal(pasteSubmits("fix the login page"), false);
  assert.equal(pasteSubmits(""), false);
});

test("a typed-in ticket needs a summary", () => {
  assert.equal(manualSubmit("  Fix login  "), "Fix login");
  assert.equal(manualSubmit("   "), null);
});

test("errors: under the Jira field with Jira (a typo before a failed load), else over the form", () => {
  const idle = { status: "idle" } as const;
  const failed = { status: "failed", reason: "SD-9 doesn't exist" } as const;
  const loading = { status: "loading", text: "Fetching…" } as const;
  assert.deepEqual(pickerErrors({ jira: true, invalid: null, load: idle }), { field: null, form: null });
  assert.deepEqual(pickerErrors({ jira: true, invalid: null, load: failed }), { field: "SD-9 doesn't exist", form: null });
  assert.deepEqual(pickerErrors({ jira: true, invalid: BAD_KEY, load: failed }), { field: BAD_KEY, form: null });
  assert.deepEqual(pickerErrors({ jira: false, invalid: null, load: failed }), { field: null, form: "SD-9 doesn't exist" });
  assert.deepEqual(pickerErrors({ jira: true, invalid: null, load: loading }), { field: null, form: null });
});

/** Runs cues through pickerCue from a fresh (armed) picker, returning what the popup did. */
function run(cues: PickerCue[]) {
  let armed = true;
  return cues.map((c) => {
    const next = pickerCue(armed, c);
    armed = next.armed;
    return next.popup;
  });
}
const seen = (isDealer: boolean, hasTicket: boolean): PickerCue => ({ t: "seen", isDealer, hasTicket });

test("it opens by itself once per stretch without a ticket, and not again after being dismissed", () => {
  assert.deepEqual(run([seen(true, false), seen(true, false), seen(true, false)]), ["open", null, null]);
});

test("a dealt ticket closes it and arms it again for the next stretch without one", () => {
  assert.deepEqual(
    run([seen(true, false), { t: "ticketChanged" }, seen(true, true), seen(true, true), seen(true, false), seen(true, false)]),
    ["open", "close", null, null, "open", null],
  );
});

test("it never opens by itself for a player, and opens when the dealer role arrives with no ticket", () => {
  assert.deepEqual(run([seen(false, false), seen(false, false), seen(true, false)]), [null, null, "open"]);
  assert.deepEqual(run([seen(true, true), seen(false, false)]), [null, null]);
});

test("the footer counts everyone but the dealer, with up to eight dots", () => {
  const many = [player("deb", { isDealer: true }), ...Array.from({ length: 10 }, (_, i) => player(`p${i}`))];
  const line = peopleLine(many);
  assert.equal(line.dots.length, MAX_DOTS);
  assert.equal(line.text, "10 at the table");
  assert.equal(line.nobody, false);
  assert.deepEqual(peopleLine([player("deb", { isDealer: true })]), { dots: [], text: "Nobody's here yet", nobody: true });
});
