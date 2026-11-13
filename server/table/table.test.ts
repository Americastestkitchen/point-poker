import { test } from "node:test";
import assert from "node:assert/strict";
import { fakeTickets, ticket } from "../tickets/fake.ts";
import { noTickets } from "../tickets/none.ts";
import type { TicketSource } from "../tickets/source.ts";
import { newTableState, TableState } from "./state.ts";
import { FLICK_COOLDOWN_MS } from "../../shared/rules.ts";
import type { Command } from "./commands.ts";
import { ROLE_ERROR, Table, type JoinRequest, type TableEvent } from "./table.ts";

const DEALER_KEY = "dealer-key";

function setup(tickets: TicketSource = noTickets()) {
  let r = 0;
  let now = 1_700_000_000_000;
  const logs: string[] = [];
  const table = new Table(newTableState("ABCD", DEALER_KEY, 0), {
    ticketsFor: () => tickets,
    now: () => now,
    random: () => (r = (r + 0.137) % 1),
    log: { info: (l: string) => logs.push(l), error: () => {} },
  });
  const events: TableEvent[] = [];
  table.on((e) => events.push(e));
  const join = (req: Partial<JoinRequest> & { name: string }) => {
    const res = table.join({ look: { color: "#3bceac" }, ...req });
    assert.ok(res.ok, "join failed");
    return res;
  };
  const deb = join({ name: "Deb", dealerKey: DEALER_KEY });
  const ann = join({ name: "Ann" });
  const bob = join({ name: "Bob" });
  const run = async (who: { playerId: string }, cmd: Command) => {
    const res = await table.run(who.playerId, cmd);
    assert.equal(res.error, undefined, `${cmd.t} failed: ${res.error}`);
    const { phase, ticket } = table.snapshot();
    assert.equal(phase === "waiting", ticket === null, `after ${cmd.t}: a table is waiting exactly when no ticket is out`);
  };
  const view = (who = ann) => table.viewFor(who.playerId);
  const player = (who: { playerId: string }) => view().players.find((p) => p.id === who.playerId)!;
  const deal = (summary = "A ticket") => run(deb, { t: "manualTicket", key: "", summary, description: "" });
  const notices = () => events.flatMap((e) => (e.t === "notice" ? [e] : []));
  const tick = (ms: number) => (now += ms);
  return { table, events, logs, deb, ann, bob, join, run, view, player, deal, notices, tick };
}

test("only the dealer runs the round", async () => {
  const { table, ann } = setup();
  assert.deepEqual(await table.run(ann.playerId, { t: "reveal" }), { error: ROLE_ERROR });
  assert.deepEqual(await table.run("nobody", { t: "vote", value: 3 }), { error: "You're not at this table" });
  assert.deepEqual(await table.run(ann.playerId, { t: "vote", value: "3" }), { error: "That command didn't make sense" });
});

test("votes stay hidden until the reveal, except your own", async () => {
  const { table, deb, ann, bob, run, view, deal } = setup();
  await deal();
  await run(ann, { t: "vote", value: 3 });
  for (const who of [deb, ann, bob]) {
    const v = view(who);
    assert.ok(v.players.every((p) => p.vote === null || p.id === who.playerId), "someone else's vote leaked");
    assert.equal(v.pot, 0);
  }
  // you always see your own card, so a reload mid-vote doesn't forget it
  assert.equal(view(ann).players.find((p) => p.id === ann.playerId)?.vote, 3);
  assert.equal(table.viewFor(null).players.find((p) => p.id === ann.playerId)?.vote, null);
  assert.deepEqual(view().players.map((p) => p.hasVoted), [false, true, false]);
  await run(deb, { t: "reveal" });
  assert.equal(view().players.find((p) => p.id === ann.playerId)?.vote, 3);
  assert.equal(view().pot, 3);
});

test("changing a face-down card shows others a fiddle, not the card", async () => {
  const { ann, run, deal, events } = setup();
  await deal();
  await run(ann, { t: "vote", value: 2 });
  await run(ann, { t: "vote", value: 3 });
  assert.deepEqual(events.filter((e) => e.t === "fx"), [{ t: "fx", from: ann.playerId, fx: { kind: "adjust" }, except: ann.playerId }]);
});

test("a card that isn't in the deck is refused and leaves your card where it was", async () => {
  const { table, ann, run, player, deal } = setup();
  await deal();
  await run(ann, { t: "vote", value: 3 });
  assert.deepEqual(await table.run(ann.playerId, { t: "vote", value: 7 }), { error: "That card isn't in the deck" });
  assert.equal(player(ann).hasVoted, true);
  await run(ann, { t: "vote", value: null }); // takes your card back
  assert.equal(player(ann).hasVoted, false);
});

test("a dealer sitting out can't vote", async () => {
  const { table, deb, view, deal } = setup();
  await deal();
  assert.deepEqual(await table.run(deb.playerId, { t: "vote", value: 3 }), { error: "You're sitting this one out" });
  assert.equal(view(deb).players.find((p) => p.id === deb.playerId)?.hasVoted, false);
});

test("re-settling takes back the last payout", async () => {
  const { deb, ann, bob, run, view, player, deal, logs } = setup();
  await deal("Login page");
  await run(ann, { t: "vote", value: 3 });
  await run(bob, { t: "vote", value: 5 });
  await run(deb, { t: "reveal" });
  await run(deb, { t: "settle", finalPoints: 5 });
  assert.deepEqual(view().winners, [bob.playerId]);
  assert.equal(player(bob).chips, 8);

  await run(deb, { t: "settle", finalPoints: 2 });
  assert.deepEqual(view().winners, [ann.playerId]);
  assert.equal(player(ann).chips, 8);
  assert.equal(player(bob).chips, 0);
  assert.deepEqual(view().history.map((h) => [h.summary, h.finalPoints, h.winners]), [["Login page", 2, ["Ann"]]]);
  assert.equal(logs.filter((l) => l.startsWith("POINTED ")).length, 2);
  assert.deepEqual(JSON.parse(logs.at(-1)!.slice(8)).votes, { Ann: 3, Bob: 5 });
});

test("nobody within one card: the house rakes in the pot", async () => {
  const { deb, ann, bob, run, view, player, deal } = setup();
  await deal();
  await run(ann, { t: "vote", value: 1 });
  await run(bob, { t: "vote", value: 2 });
  await run(deb, { t: "reveal" });
  await run(deb, { t: "settle", finalPoints: 8 });
  assert.equal(view().houseWon, true);
  assert.deepEqual(view().winners, [deb.playerId]);
  assert.equal(player(deb).chips, 3);
  const [result] = view().history;
  assert.ok(result);
  assert.equal(result.houseWon, true);
});

test("a dealer who plays along votes and can win", async () => {
  const { deb, ann, run, view, player, deal } = setup();
  await run(deb, { t: "dealerPlays", plays: true });
  await deal();
  await run(deb, { t: "vote", value: 5 });
  await run(ann, { t: "vote", value: 1 });
  await run(deb, { t: "reveal" });
  await run(deb, { t: "settle", finalPoints: 5 });
  assert.deepEqual(view().winners, [deb.playerId]);
  assert.equal(player(deb).chips, 6);
  await run(deb, { t: "dealerPlays", plays: false });
  assert.equal(player(deb).plays, false);
});

test("skip pays nobody and deals the next unpointed ticket in the queue", async () => {
  const tickets = fakeTickets(
    [ticket("EP-1", { type: "Epic" }), ticket("AB-1", { currentPoints: 3 }), ticket("AB-2"), ticket("AB-3")],
    { children: { "EP-1": ["AB-1", "AB-2", "AB-3"] } },
  );
  const { deb, ann, run, view, player, notices } = setup(tickets);
  await run(deb, { t: "loadTicket", ref: "https://jira.example/browse/EP-1" });
  assert.equal(view().ticket?.key, "AB-2", "the first ticket without points");
  assert.equal(view().queueLabel, "Epic EP-1");
  assert.equal(view().epic?.key, "EP-1");
  await run(ann, { t: "vote", value: 5 });

  await run(deb, { t: "skip" });
  assert.equal(view().ticket?.key, "AB-3");
  assert.equal(view().phase, "voting");
  assert.deepEqual(view().skipped, ["AB-2"]);
  assert.equal(player(ann).chips, 0);
  assert.equal(player(ann).hasVoted, false);
  assert.deepEqual(notices(), [{ t: "notice", text: "⏭️ The dealer skipped AB-2", except: deb.playerId }]);
  assert.deepEqual(view().queue.map((q) => q.played), [false, true, false]);
});

test("next round deals the next queued ticket after a settle", async () => {
  const tickets = fakeTickets([ticket("EP-1", { type: "Epic" }), ticket("AB-1"), ticket("AB-2")], { children: { "EP-1": ["AB-1", "AB-2"] } });
  const { deb, run, view } = setup(tickets);
  await run(deb, { t: "loadTicket", ref: "EP-1" });
  await run(deb, { t: "reveal" });
  await run(deb, { t: "settle", finalPoints: 3 });
  await run(deb, { t: "nextRound" });
  assert.equal(view().ticket?.key, "AB-2");
  assert.equal(view().round, 2);
  await run(deb, { t: "reveal" });
  await run(deb, { t: "settle", finalPoints: 3 });
  await run(deb, { t: "nextRound" });
  assert.equal(view().ticket, null, "the queue is used up");
  assert.equal(view().phase, "waiting");
});

test("cancel drops the round without paying anyone", async () => {
  const { table, deb, ann, run, view, player, deal, notices } = setup();
  await deal();
  await run(ann, { t: "vote", value: 3 });
  await run(deb, { t: "reveal" });
  await run(deb, { t: "cancelRound" });
  assert.equal(view().phase, "waiting");
  assert.equal(view().ticket, null);
  assert.equal(player(ann).chips, 0);
  assert.equal(view().history.length, 0);
  assert.deepEqual(notices().map((n) => n.text), ["🎩 The dealer cancelled this round"]);

  // a settled round is already paid out: cancel says so and changes nothing
  await deal();
  await run(deb, { t: "reveal" });
  await run(deb, { t: "settle", finalPoints: 3 });
  assert.deepEqual(await table.run(deb.playerId, { t: "cancelRound" }), { error: "This round is already paid out" });
  assert.equal(view().phase, "settled");
});

test("a move the phase doesn't allow is refused with a reason, and changes nothing", async () => {
  const { table, deb, ann, run, view, deal } = setup();
  const tries = (who: { playerId: string }, ...cmds: Command[]) => Promise.all(cmds.map(async (c) => (await table.run(who.playerId, c)).error));

  assert.deepEqual(await tries(deb, { t: "deal" }, { t: "reveal" }, { t: "settle", finalPoints: 3 }, { t: "cancelRound" }, { t: "skip" }), [
    "Load a ticket first", "There's no vote to reveal", "Reveal the cards first", "There's no round to cancel", "There's no ticket to skip",
  ]);
  assert.deepEqual(await tries(ann, { t: "vote", value: 3 }), ["There's nothing to vote on yet"]);
  assert.equal(view().phase, "waiting");

  await deal();
  assert.deepEqual(await tries(deb, { t: "settle", finalPoints: 3 }), ["Reveal the cards first"]);
  await run(deb, { t: "reveal" });
  assert.deepEqual(await tries(deb, { t: "reveal" }, { t: "settle", finalPoints: 4 }), ["The cards are already up", "That card isn't in the deck"]);
  assert.deepEqual(await tries(ann, { t: "vote", value: 3 }), ["Voting is over"]);
  await run(deb, { t: "settle", finalPoints: 3 });
  assert.deepEqual(await tries(deb, { t: "skip" }), ["This round is already paid out"]);
  assert.equal(view().phase, "settled");
});

test("kick removes a player for good, but never the dealer", async () => {
  const { table, deb, ann, run, view, events, join } = setup();
  const cat = join({ name: "Cat" });
  await run(deb, { t: "kick", id: cat.playerId });
  assert.ok(!view().players.some((p) => p.id === cat.playerId));
  assert.ok(events.some((e) => e.t === "removed" && e.playerId === cat.playerId && e.reason === "Removed by the dealer"));
  assert.deepEqual(table.join({ name: "Cat", look: {}, token: cat.token }), { ok: false, code: 4001, reason: "Removed by the dealer" });

  assert.deepEqual(await table.run(deb.playerId, { t: "kick", id: deb.playerId }), { error: "You can't remove yourself" });
  assert.ok(view().players.some((p) => p.id === deb.playerId));
  assert.deepEqual(await table.run(deb.playerId, { t: "kick", id: cat.playerId }), { error: "They're not at this table" });
  assert.deepEqual(await table.run(deb.playerId, { t: "kick", id: "nobody" }), { error: "They're not at this table" });
  assert.equal(view().players.length, 3);
  assert.equal(ann.isDealer, false);
});

test("a ticket typed in by hand needs a summary", async () => {
  const { table, deb, view } = setup();
  assert.deepEqual(await table.run(deb.playerId, { t: "manualTicket", key: "SD-1", summary: "  \n ", description: "" }), { error: "The ticket needs a summary" });
  assert.equal(view().ticket, null);
  assert.equal(view().phase, "waiting");
});

test("seat tokens bring players back to their seat; the table fills up at eight", () => {
  const { table, ann, join } = setup();
  table.disconnect(ann.playerId);
  assert.equal(table.viewFor(null).players.find((p) => p.id === ann.playerId)?.connected, false);
  const again = join({ name: "Ann again", token: ann.token });
  assert.equal(again.playerId, ann.playerId);
  assert.equal(table.viewFor(null).players.find((p) => p.id === ann.playerId)?.name, "Ann again");
  for (let i = 0; i < 6; i++) join({ name: `P${i}` });
  assert.deepEqual(table.join({ name: "One too many", look: {} }), { ok: false, code: 4003, reason: "Table full", text: "The table is full" });
});

test("a slow ticket load finishing after a newer one doesn't win", async () => {
  let release!: () => void;
  const slow = new Promise<void>((r) => (release = r));
  const tickets = fakeTickets([ticket("SD-1"), ticket("SD-2")], { wait: (key) => (key === "SD-1" ? slow : Promise.resolve()) });
  const { table, deb, view } = setup(tickets);

  const first = table.run(deb.playerId, { t: "loadTicket", ref: "SD-1" });
  assert.deepEqual(await table.run(deb.playerId, { t: "loadTicket", ref: "SD-2" }), {});
  assert.equal(view().ticket?.key, "SD-2");
  release();
  assert.deepEqual(await first, {}, "the stale load isn't an error either");
  assert.equal(view().ticket?.key, "SD-2");
  assert.equal(view().round, 1);
});

test("a ticket typed in by hand beats a load still in flight", async () => {
  let release!: () => void;
  const slow = new Promise<void>((r) => (release = r));
  const { table, deb, view, deal } = setup(fakeTickets([ticket("SD-1")], { wait: () => slow }));
  const load = table.run(deb.playerId, { t: "loadTicket", ref: "SD-1" });
  await deal("Typed in");
  release();
  await load;
  assert.equal(view().ticket?.summary, "Typed in");
});

test("failed loads tell the dealer why", async () => {
  const { table, deb, view } = setup(fakeTickets([ticket("EP-9", { type: "Epic" })]));
  assert.deepEqual(await table.run(deb.playerId, { t: "loadTicket", ref: "nope" }), { error: "That doesn't look like a Jira link or key (like SD-1234)" });
  assert.deepEqual(await table.run(deb.playerId, { t: "loadTicket", ref: "SD-404" }), { error: "SD-404: Ticket not found (or no access)" });
  assert.deepEqual(await table.run(deb.playerId, { t: "loadTicket", ref: "EP-9" }), { error: "EP-9: That epic has no child tickets" });
  assert.deepEqual(await table.run(deb.playerId, { t: "deal" }), { error: "Load a ticket first" });
  const offline = setup(noTickets());
  assert.deepEqual(await offline.table.run(offline.deb.playerId, { t: "fetchQueue" }), { error: "Couldn't load the sprint: Jira isn't configured on the server" });
  assert.equal(view().jiraEnabled, true);
  assert.equal(offline.view().jiraEnabled, false);
});

test("the sprint list fills the queue", async () => {
  const { deb, run, view } = setup(fakeTickets([ticket("SD-1"), ticket("SD-2", { currentPoints: 2 })], { upcoming: ["SD-1", "SD-2"] }));
  await run(deb, { t: "fetchQueue" });
  assert.equal(view().queueLabel, "Current & upcoming sprints");
  assert.deepEqual(view().queue.map((q) => [q.key, q.points]), [["SD-1", null], ["SD-2", 2]]);
  await run(deb, { t: "clearQueue" });
  assert.deepEqual(view().queue, []);
});

test("a table's snapshot is plain JSON that loads back into the same table", async () => {
  const { table, deb, ann, run, deal } = setup();
  await deal();
  await run(ann, { t: "vote", value: 3 });
  await run(deb, { t: "reveal" });
  await run(deb, { t: "settle", finalPoints: 3 });
  const snap = table.snapshot();
  assert.deepEqual(JSON.parse(JSON.stringify(snap)), snap, "a field didn't survive JSON");
  assert.ok(TableState.safeParse(snap).success);

  const restored = new Table(TableState.parse(JSON.parse(JSON.stringify(snap))), {
    ticketsFor: noTickets, now: () => 0, random: Math.random, log: console,
  });
  assert.deepEqual(restored.viewFor(null), { ...table.viewFor(null), players: table.viewFor(null).players.map((p) => ({ ...p, connected: false })) });
});

test("chip flicks have a cooldown the server enforces", async () => {
  const { table, ann, bob, events, tick } = setup();
  const flicks = () => events.filter((e) => e.t === "fx" && e.fx.kind === "flick").length;
  assert.deepEqual(await table.run(ann.playerId, { t: "flick", target: bob.playerId }), {});
  assert.deepEqual(await table.run(ann.playerId, { t: "flick", target: bob.playerId }), { error: "Not so fast" });
  assert.deepEqual(await table.run(bob.playerId, { t: "flick", target: ann.playerId }), {}, "everyone has their own cooldown");
  tick(FLICK_COOLDOWN_MS);
  assert.deepEqual(await table.run(ann.playerId, { t: "flick", target: bob.playerId }), {});
  assert.equal(flicks(), 3);
  tick(FLICK_COOLDOWN_MS);
  assert.deepEqual(await table.run(ann.playerId, { t: "flick", target: ann.playerId }), { error: "You can't flick yourself" });
  assert.deepEqual(await table.run(ann.playerId, { t: "flick", target: "nobody" }), { error: "There's nobody in that seat" });
  assert.equal(flicks(), 3, "no flicking yourself or empty chairs");
  assert.deepEqual(await table.run(ann.playerId, { t: "flick", target: bob.playerId }), {}, "and a refused flick doesn't start the cooldown");
});

test("a look is one object, cleaned up on the way in", async () => {
  const { ann, run, player, join } = setup();
  await run(ann, { t: "setLook", look: { color: "#ffd23f", body: "pear", cosmetics: ["crown", "fez", "jetpack"] } });
  assert.deepEqual(player(ann).look, { color: "#ffd23f", body: "pear", cosmetics: ["crown"] }, "one hat at a time, no made-up items");
  const odd = join({ name: "Odd", look: { color: "plaid", body: "blob" } });
  assert.deepEqual(player(odd).look, { color: "#ff6b4a", body: "bean", cosmetics: [] });
});
