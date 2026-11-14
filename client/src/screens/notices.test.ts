import { test } from "node:test";
import assert from "node:assert/strict";
import { player } from "../app/fixtures.ts";
import { connectionNotice, eventNotice, forYouNotice, viewNotice } from "./notices.ts";

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

test("someone pointing at you says so; pointing at someone else, or anything else used on you, doesn't", () => {
  const players = [player("ann"), player("bob")];
  const use = (item: "point" | "hammer", to: string) =>
    forYouNotice({ t: "fx", from: "ann", fx: { kind: "use", item, to } }, players, "bob");
  assert.equal(use("point", "bob")?.text, "👉 ANN is pointing at you");
  assert.equal(use("point", "cat"), null);
  assert.equal(use("hammer", "bob"), null, "you can't miss a hammer");
  assert.equal(
    forYouNotice({ t: "fx", from: "gone", fx: { kind: "use", item: "point", to: "bob" } }, players, "bob"),
    null,
  );
});

test("being removed by the dealer says so, once", () => {
  const open = { status: "open", room: "ABCD" } as const;
  const removed = { status: "closed", room: "ABCD", reason: "Removed by the dealer" } as const;
  assert.equal(connectionNotice(open, removed)?.tone, "error");
  assert.equal(connectionNotice(removed, removed), null, "the same state again isn't news");
  assert.equal(connectionNotice(open, { status: "closed", room: "ABCD", reason: "Table full" }), null);
  assert.equal(connectionNotice(open, { status: "connecting", room: "ABCD", attempt: 1 }), null);
});

test("an emote that's for you says who sent it; everyone else's are just emotes", () => {
  const players = [player("ann"), player("bob", { name: "Bob" })];
  const laugh = (from: string, to?: string) =>
    ({ t: "fx", from, fx: { kind: "emote", emote: "laugh", ...(to ? { to } : {}) } }) as const;
  assert.deepEqual(forYouNotice(laugh("bob", "ann"), players, "ann"), {
    text: "😂 Bob, right back at you",
    tone: "info",
    bonk: false,
  });
  assert.equal(forYouNotice(laugh("bob"), players, "ann"), null, "for the whole table");
  assert.equal(forYouNotice(laugh("bob", "cat"), players, "ann"), null, "for someone else");
  assert.equal(forYouNotice(laugh("ann", "ann"), players, "ann"), null, "your own");
  assert.equal(forYouNotice(laugh("zed", "ann"), players, "ann"), null, "from someone who's gone");
  assert.equal(forYouNotice(laugh("bob", "ann"), players, undefined), null, "before you're seated");
});
