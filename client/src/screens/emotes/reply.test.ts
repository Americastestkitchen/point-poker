import { test } from "node:test";
import assert from "node:assert/strict";
import { player } from "../../app/fixtures.ts";
import { offeredBy, offerFrom, offerText } from "./reply.ts";

const wave = (from: string, to?: string) =>
  ({ t: "fx", from, fx: { kind: "emote", emote: "wave", ...(to ? { to } : {}) } }) as const;

test("someone else's emote is one you can answer; your own isn't", () => {
  assert.deepEqual(offerFrom(wave("bob"), "ann"), { from: "bob", emote: "wave" });
  assert.deepEqual(offerFrom(wave("bob", "ann"), "ann"), { from: "bob", emote: "wave" }, "an answer can be answered");
  assert.equal(offerFrom(wave("ann"), "ann"), null);
  assert.equal(offerFrom({ t: "fx", from: "bob", fx: { kind: "squeak" } }, "ann"), null);
  assert.equal(offerFrom({ t: "toast", text: "hi" }, "ann"), null);
});

test("an offer only stands while whoever made it is still at the table", () => {
  const players = [player("ann"), player("bob", { name: "Bob" })];
  const offer = { from: "bob", emote: "laugh" } as const;
  assert.equal(offeredBy(offer, players)?.name, "Bob");
  assert.equal(offeredBy(offer, [player("ann")]), null, "they left");
  assert.equal(offeredBy(null, players), null);
  assert.equal(offerText(offer, players[1]!), "😂 Bob");
});
