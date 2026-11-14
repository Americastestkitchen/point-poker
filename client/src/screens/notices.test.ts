import { test } from "node:test";
import assert from "node:assert/strict";
import { player } from "../app/fixtures.ts";
import { connectionNotice, eventNotice, viewNotice } from "./notices.ts";

test("others sitting down and anyone leaving get a toast; you sitting down doesn't", () => {
  assert.equal(viewNotice({ t: "joined", player: player("ann") }, "bob")?.text, "👋 ANN sat down");
  assert.equal(viewNotice({ t: "joined", player: player("ann") }, "ann"), null);
  assert.equal(viewNotice({ t: "left", player: player("bob") }, "ann")?.text, "🚪 BOB left");
  assert.equal(viewNotice({ t: "dealt" }, "ann"), null);
});

test("toasts from the event stream keep their level; errors bonk", () => {
  assert.deepEqual(eventNotice({ t: "toast", text: "SD-1 was updated" }), {
    text: "SD-1 was updated",
    tone: "info",
    bonk: false,
  });
  assert.deepEqual(eventNotice({ t: "toast", text: "Jira said no", level: "error" }), {
    text: "Jira said no",
    tone: "error",
    bonk: true,
  });
  assert.equal(eventNotice({ t: "hit", item: "hammer" }), null);
});

test("being removed by the dealer says so, once", () => {
  const open = { status: "open", room: "ABCD" } as const;
  const removed = { status: "closed", room: "ABCD", reason: "Removed by the dealer" } as const;
  assert.equal(connectionNotice(open, removed)?.tone, "error");
  assert.equal(connectionNotice(removed, removed), null, "the same state again isn't news");
  assert.equal(connectionNotice(open, { status: "closed", room: "ABCD", reason: "Table full" }), null);
  assert.equal(connectionNotice(open, { status: "connecting", room: "ABCD", attempt: 1 }), null);
});
