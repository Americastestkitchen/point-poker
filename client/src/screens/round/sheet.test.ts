import { test } from "node:test";
import assert from "node:assert/strict";
import { player, ticket, view } from "../../app/fixtures.ts";
import { assignee, crumbs, initials, sheetMove, statusTone } from "./sheet.ts";
import { cardFace } from "./card.ts";

test("the sheet opens when you arrive mid-vote, soon after a deal, and goes away on the reveal", () => {
  const voting = view({ phase: "voting", round: 1, ticket: ticket("SD-1") });
  assert.equal(sheetMove({ t: "synced" }, voting), "open");
  assert.equal(
    sheetMove({ t: "synced" }, { ...voting, phase: "revealed" }),
    null,
    "arriving after the reveal: the cards matter now",
  );
  assert.equal(sheetMove({ t: "synced" }, view()), null, "no ticket, nothing to read");
  assert.equal(sheetMove({ t: "dealt" }, voting), "openSoon");
  assert.equal(sheetMove({ t: "dealt" }, { ...voting, ticket: null }), null);
  assert.equal(sheetMove({ t: "revealed" }, { ...voting, phase: "revealed" }), "close");
  assert.equal(sheetMove({ t: "ticketChanged" }, voting), null);
  assert.equal(sheetMove({ t: "joined", player: player("cat") }, voting), null);
});

test("breadcrumbs: project, then the parent or the epic, then the ticket linking to Jira", () => {
  const t = { ...ticket("SD-12"), type: "Bug", url: "https://jira.example.com/browse/SD-12" };
  assert.deepEqual(crumbs(t, null), [
    { text: "Projects" },
    { text: "SD" },
    { text: "SD-12", type: "Bug", href: "https://jira.example.com/browse/SD-12" },
  ]);
  const epic = { key: "SD-1", summary: "Epic", url: "" };
  assert.deepEqual(crumbs(t, epic)[2], { text: "SD-1", type: "epic" });
  const child = { ...t, parent: { key: "SD-5", summary: "Parent" } };
  assert.deepEqual(crumbs(child, epic)[2], { text: "SD-5", type: "epic" }, "the parent wins over the loaded epic");
  const typedIn = { ...ticket("MAN-3"), url: "javascript:alert(1)" };
  assert.deepEqual(
    crumbs(typedIn, null).at(-1),
    { text: "MAN-3", type: "task" },
    "no link without an http(s) url; no type reads as a task",
  );
});

test("initials, the status colour and the assignee", () => {
  assert.equal(initials("Ada Lovelace"), "AL");
  assert.equal(initials("  grace  brewster murray hopper "), "GB");
  assert.equal(initials("Ömer"), "Ö");
  assert.equal(statusTone({ ...ticket("A-1"), statusCategory: "" }), "new");
  assert.equal(statusTone({ ...ticket("A-1"), statusCategory: "done" }), "done");
  assert.equal(assignee({ ...ticket("A-1"), assignee: "Unassigned" }), "");
  assert.equal(assignee({ ...ticket("A-1"), assignee: "Ada" }), "Ada");
});

test("cards wear their suit and the same small tilt every time", () => {
  assert.deepEqual(cardFace(3), { value: 3, glyph: "♦", red: true, tilt: cardFace(3).tilt });
  assert.equal(cardFace(5).red, false);
  assert.deepEqual(cardFace(40).glyph, "♠", "a value with no suit is a spade");
  for (const v of [0, 1, 2, 3, 5, 8, 13, 21, 40, 100]) assert.ok(Math.abs(cardFace(v).tilt) <= 1.8);
  assert.notEqual(cardFace(1).tilt, cardFace(2).tilt);
});
