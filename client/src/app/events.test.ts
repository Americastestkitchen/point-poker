import { test } from "node:test";
import assert from "node:assert/strict";
import { diff } from "./events.ts";
import { player, ticket, view, withPlayers } from "./fixtures.ts";

const kinds = (evs: ReturnType<typeof diff>) => evs.map((e) => e.t);

test("the first view is just 'synced'", () => {
  assert.deepEqual(diff(null, view({ phase: "settled" })), [{ t: "synced" }]);
});

test("people arriving, leaving and changing shape", () => {
  const before = view();
  const after = { ...before, players: [...before.players.filter((p) => p.id !== "bob"), player("cat")] };
  after.players = after.players.map((p) => (p.id === "ann" ? { ...p, look: { ...p.look, body: "pear" as const } } : p));
  const evs = diff(before, after);
  assert.deepEqual(evs.filter((e) => e.t === "joined").map((e) => e.t === "joined" && e.player.id), ["cat"]);
  assert.deepEqual(evs.filter((e) => e.t === "left").map((e) => e.t === "left" && e.player.id), ["bob"]);
  assert.deepEqual(evs.filter((e) => e.t === "reshaped").map((e) => e.t === "reshaped" && e.player.look.body), ["pear"]);
  assert.deepEqual(diff(before, withPlayers(before, (p) => ({ look: { ...p.look, color: "#ff6b4a", cosmetics: ["crown"] } }))), [], "a new colour or hat isn't news");
});

test("a deal, and a re-deal of the same ticket", () => {
  const waiting = view();
  const voting = view({ phase: "voting", round: 1, ticket: ticket("SD-1") });
  assert.deepEqual(kinds(diff(waiting, voting)), ["dealt", "ticketChanged"]);
  assert.deepEqual(kinds(diff(voting, { ...voting, round: 2 })), ["dealt", "ticketChanged"], "restarting the vote deals again");
  assert.deepEqual(kinds(diff(voting, { ...voting })), []);
});

test("everyone's in, once", () => {
  const voting = view({ phase: "voting", round: 1, ticket: ticket("SD-1") });
  const oneIn = withPlayers(voting, (p) => ({ hasVoted: p.id === "ann" }));
  const allIn = withPlayers(voting, (p) => ({ hasVoted: p.plays }));
  assert.deepEqual(kinds(diff(voting, oneIn)), []);
  assert.deepEqual(kinds(diff(oneIn, allIn)), ["allIn"]);
  assert.deepEqual(kinds(diff(allIn, { ...allIn })), [], "not again while nothing changes");
  const swapped = withPlayers(allIn, (p) => (p.id === "ann" ? { name: "Ann B" } : {}));
  assert.deepEqual(kinds(diff(allIn, swapped)), []);
});

test("reveal, settle and a change of mind", () => {
  const voting = withPlayers(view({ phase: "voting", round: 1, ticket: ticket("SD-1") }), (p) => ({ hasVoted: p.plays }));
  const revealed = withPlayers({ ...voting, phase: "revealed", pot: 8 }, (p) => ({ vote: p.id === "ann" ? 3 : p.id === "bob" ? 5 : null }));
  const settled = { ...revealed, phase: "settled" as const, finalPoints: 5, winners: ["bob"] };
  assert.deepEqual(kinds(diff(voting, revealed)), ["revealed"]);
  assert.deepEqual(diff(revealed, settled), [{ t: "settled", resettled: false }]);
  assert.deepEqual(diff(settled, { ...settled, finalPoints: 3, winners: ["ann"] }), [{ t: "settled", resettled: true }]);
  assert.deepEqual(diff(settled, { ...settled }), []);
});

