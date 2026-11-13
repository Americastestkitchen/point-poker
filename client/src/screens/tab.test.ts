import { test } from "node:test";
import assert from "node:assert/strict";
import { player, ticket, view, withPlayers } from "../app/fixtures.ts";
import type { TableView } from "../../../shared/protocol.ts";
import { chimeFor, tabTitle } from "./tab.ts";

// deb deals (sits out), ann and bob play
const voting = (extra: Partial<TableView> = {}) =>
  view({ phase: "voting", round: 1, ticket: ticket("SD-1"), ...extra });
const allIn = (room: TableView) => withPlayers(room, (p) => (p.plays ? { hasVoted: true } : {}));

test("the tab shows the ticket, and 'All in' to the dealer once every voter has a card down", () => {
  assert.equal(tabTitle(null, undefined), "Point Poker");
  assert.equal(tabTitle(view(), "deb"), "Point Poker");
  assert.equal(tabTitle(voting(), "deb"), "SD-1 · Point Poker");
  const oneIn = withPlayers(voting(), (p) => (p.id === "ann" ? { hasVoted: true } : {}));
  assert.equal(tabTitle(oneIn, "deb"), "SD-1 · Point Poker");
  assert.equal(tabTitle(allIn(voting()), "deb"), "✅ All in · Point Poker");
  assert.equal(tabTitle(allIn(voting()), "ann"), "SD-1 · Point Poker", "only the dealer is waited on");
  // the round moves on: back to the ticket
  assert.equal(tabTitle(allIn(voting({ phase: "revealed" })), "deb"), "SD-1 · Point Poker");
  const empty = voting({ players: [player("deb", { isDealer: true, plays: false })] });
  assert.equal(tabTitle(empty, "deb"), "SD-1 · Point Poker", "nobody here isn't everyone");
});

test("the dealer's chime rings once per round, when the last card goes down", () => {
  const room = allIn(voting());
  const change = { t: "allIn" } as const;
  assert.equal(chimeFor(change, room, "deb", null), "ABCD:1");
  assert.equal(chimeFor(change, room, "deb", "ABCD:1"), null, "a card taken back and put down again");
  assert.equal(chimeFor(change, allIn(voting({ round: 2 })), "deb", "ABCD:1"), "ABCD:2", "a restarted vote");
  assert.equal(chimeFor(change, room, "ann", null), null, "players don't hear it");
  assert.equal(chimeFor({ t: "dealt" }, room, "deb", null), null);
});
