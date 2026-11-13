import { test } from "node:test";
import assert from "node:assert/strict";
import type { RoundResult } from "../../../../shared/protocol.ts";
import { player, view } from "../../app/fixtures.ts";
import {
  backTo,
  boardRows,
  burstSize,
  clinks,
  coinFlight,
  connectionLabel,
  jiraExport,
  micPressed,
  micTip,
  roundOutcome,
  roundsNewestFirst,
  walletWin,
} from "./model.ts";

test("the top bar only talks about the connection while it's down", () => {
  assert.equal(connectionLabel({ status: "open", room: "ABCD" }), null);
  assert.equal(connectionLabel({ status: "idle" }), null);
  assert.equal(connectionLabel({ status: "connecting", room: "ABCD", attempt: 2 }), "reconnecting…");
  assert.equal(connectionLabel({ status: "closed", room: "ABCD", reason: "Table full" }), "disconnected: Table full");
  assert.equal(
    connectionLabel({ status: "closed", room: "ABCD", reason: "" }),
    "disconnected",
    "no dangling colon when there's no reason",
  );
});

test("the mic button keeps its tooltips, and looks pressed while listening or asking", () => {
  assert.match(micTip("on"), /^Mic on: .*Click to turn off\.$/);
  assert.match(micTip("off"), /^Turn on mic: .*no audio is sent/);
  assert.equal(micTip("denied"), micTip("off"));
  assert.deepEqual((["off", "starting", "on", "denied"] as const).map(micPressed), [false, true, true, false]);
});

test("coins fly in only when a settle pays you", () => {
  const room = view({ phase: "settled", winners: ["ann"], share: 7 });
  assert.equal(walletWin([{ t: "settled", resettled: false }], room, "ann"), 7);
  assert.equal(
    walletWin([{ t: "settled", resettled: true }], room, "ann"),
    7,
    "a changed call that still pays you, as before",
  );
  assert.equal(walletWin([{ t: "settled", resettled: false }], room, "bob"), null, "someone else won");
  assert.equal(walletWin([{ t: "synced" }], room, "ann"), null, "arriving at a settled table isn't a win");
  assert.equal(walletWin([{ t: "settled", resettled: false }], room, undefined), null);
  const house = view({ phase: "settled", winners: ["deb"], share: 12, houseWon: true });
  assert.equal(
    walletWin([{ t: "settled", resettled: false }], house, "deb"),
    12,
    "the house's dealer rakes in the pot",
  );
});

test("a burst has a handful of coins, more for bigger wins, never a flood", () => {
  assert.equal(burstSize(1), 8);
  assert.equal(burstSize(13.4), 13);
  assert.equal(burstSize(500), 28);
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(clinks), [false, false, true, false, false, true]);
});

test("a coin starts small at the burst and ends at the wallet", () => {
  const { keyframes, timing } = coinFlight(2, { x: 100, y: 50 }, { x: 900, y: 20 }, 0, 60);
  assert.equal(keyframes[0]?.transform, "translate(100px, 50px) scale(.3)");
  assert.equal(keyframes[1]?.transform, "translate(160px, 50px) scale(1.15)");
  assert.equal(keyframes.at(-1)?.transform, "translate(900px, 20px) scale(.55)");
  assert.equal(timing.delay, 36);
  assert.ok(timing.duration > 1150, "later coins take a little longer, so they stream in");
});

test("the leaderboard is by chips, with a crown, tags and the dealer's remove", () => {
  const players = [
    player("deb", { isDealer: true, chips: 3 }),
    player("ann", { chips: 10 }),
    player("bob", { chips: 3, connected: false }),
    player("cat", { chips: 0, connected: false, isDealer: false }),
  ];
  const rows = boardRows(players, "ann", true);
  assert.deepEqual(
    rows.map((r) => r.player.id),
    ["ann", "deb", "bob", "cat"],
    "ties keep their order",
  );
  assert.deepEqual(
    rows.map((r) => r.rank),
    ["👑", "2", "3", "4"],
  );
  assert.deepEqual(
    rows.map((r) => r.name),
    ["ANN", "DEB · dealer", "BOB · away", "CAT · away"],
  );
  assert.deepEqual(
    rows.map((r) => r.me),
    [true, false, false, false],
  );
  assert.deepEqual(
    rows.map((r) => r.removable),
    [false, false, true, true],
  );
  assert.ok(
    boardRows(players, "ann", false).every((r) => !r.removable),
    "only the dealer removes people",
  );
  assert.equal(boardRows([player("ann")], "ann", false)[0]?.rank, "1", "no crown for a leader with nothing");
  assert.deepEqual(boardRows([], "ann", false), []);
  const away = boardRows([player("deb", { isDealer: true, connected: false })], "x", true);
  assert.equal(away[0]?.removable, false, "the dealer's own seat isn't removable");
});

const round = (key: string, extra: Partial<RoundResult> = {}): RoundResult => ({
  key,
  summary: `About ${key}`,
  finalPoints: 5,
  pot: 10,
  winners: [],
  share: 0,
  ...extra,
});

test("rounds read as before: house wins, winners and their share, or nobody played", () => {
  assert.equal(roundOutcome(round("A", { houseWon: true, winners: ["Deb"], share: 12 })), "house wins · Deb +12");
  assert.equal(roundOutcome(round("A", { winners: ["Ann", "Bob"], share: 4 })), "Ann & Bob +4");
  assert.equal(roundOutcome(round("A")), "no cards played");
  assert.deepEqual(
    roundsNewestFirst([round("A"), round("B")]).map((h) => h.key),
    ["B", "A"],
  );
});

test("Copy for Jira: the latest points per ticket, oldest first, tab-separated", () => {
  const out = jiraExport([
    round("SD-1", { finalPoints: 3 }),
    round("SD-2", { finalPoints: 8 }),
    round("SD-1", { finalPoints: 5 }),
  ]);
  assert.equal(out.text, "SD-1\t5 pts\tAbout SD-1\nSD-2\t8 pts\tAbout SD-2");
  assert.equal(out.count, 2);
  assert.equal(out.done, "📋 Copied 2 tickets and their points");
  assert.equal(jiraExport([round("SD-9")]).done, "📋 Copied 1 ticket and their points");
  assert.deepEqual(jiraExport([]), { text: "", count: 0, done: "📋 Copied 0 tickets and their points" });
});

test("closing Options or How to play goes back to the menu only when that's where they came from", () => {
  assert.equal(backTo("menu"), "menu");
  assert.equal(backTo(null), null);
  assert.equal(backTo("leaderboard"), null);
});
