import { test } from "node:test";
import assert from "node:assert/strict";
import { player, ticket, view, withPlayers } from "../../app/fixtures.ts";
import type { TableView } from "../../../../shared/protocol.ts";
import { safeUrl } from "../text.ts";
import { dockModel, plain, type Dock, type DockBody } from "./dock.ts";

// deb deals (sits out), ann and bob play
const dock = (room: TableView, meId: string, myVote: number | null = null) => dockModel({ room, meId, myVote });
const title = (d: Dock) => (d.title ? plain(d.title) : null);
const cards = (b: DockBody | null) => (b && (b.t === "vote" || b.t === "settle") ? b.cards : []);
const voting = (extra: Partial<TableView> = {}) =>
  view({ phase: "voting", round: 1, ticket: ticket("SD-1"), ...extra });

test("waiting: the dealer adds a ticket, players wait with a spinner", () => {
  const room = view();
  assert.deepEqual(dock(room, "deb"), { key: "waiting:0", title: null, body: { t: "addTicket" }, actions: [] });
  assert.deepEqual(dock(room, "ann").body, { t: "waiting", text: "The dealer is picking a ticket" });
  assert.deepEqual(dock(room, "ann").actions, []);
});

test("voting: a voter gets the whole deck to pick from", () => {
  const d = dock(voting(), "ann");
  assert.equal(title(d), "How big is it? Pick a card");
  assert.deepEqual(
    cards(d.body).map((c) => c.value),
    [1, 2, 3, 5, 8],
  );
  assert.ok(cards(d.body).every((c) => !c.selected && !c.dimmed && c.press?.t === "vote"));
  assert.deepEqual(d.actions, [], "players get no dealer buttons");
});

test("voting: your card is lit, the others dimmed, and the title says it", () => {
  const d = dock(voting(), "ann", 5);
  assert.equal(title(d), "You picked 5 · tap another card to change");
  assert.deepEqual(d.title?.[1], { strong: "5" });
  const hand = cards(d.body);
  assert.deepEqual(
    hand.filter((c) => c.selected).map((c) => c.value),
    [5],
  );
  assert.deepEqual(
    hand.filter((c) => c.dimmed).map((c) => c.value),
    [1, 2, 3, 8],
  );
  assert.deepEqual(hand.find((c) => c.value === 8)?.press, { t: "vote", value: 8 });
});

test("voting: a dealer who sits out sees who we're waiting on, up to four names", () => {
  assert.equal(title(dock(voting(), "deb")), "Waiting on ANN & BOB");
  assert.equal(dock(voting(), "deb").body, null, "no hand to play");
  const crowd = voting({
    players: [player("deb", { isDealer: true, plays: false }), ...["a", "b", "c", "d", "e"].map((id) => player(id))],
  });
  assert.equal(title(dock(crowd, "deb")), "Waiting on A, B, C & D…");
  const oneIn = withPlayers(voting(), (p) => (p.id === "ann" ? { hasVoted: true } : {}));
  assert.equal(title(dock(oneIn, "deb")), "Waiting on BOB");
  const allIn = withPlayers(voting(), (p) => (p.plays ? { hasVoted: true } : {}));
  assert.equal(title(dock(allIn, "deb")), "Everyone's in!");
  const empty = voting({ players: [player("deb", { isDealer: true, plays: false })] });
  assert.equal(title(dock(empty, "deb")), "Nobody's at the table yet");
});

test("voting: the dealer can reveal once someone's in (calling out when everyone is), skip or restart", () => {
  assert.deepEqual(dock(voting(), "deb").actions, [
    { t: "reveal", voted: 0, of: 2, everyone: false },
    { t: "skip" },
    { t: "restart", label: "Restart vote" },
  ]);
  const oneIn = withPlayers(voting(), (p) => (p.id === "ann" ? { hasVoted: true } : {}));
  assert.deepEqual(dock(oneIn, "deb").actions[0], { t: "reveal", voted: 1, of: 2, everyone: false });
  const allIn = withPlayers(voting(), (p) => (p.plays ? { hasVoted: true } : {}));
  assert.deepEqual(dock(allIn, "deb").actions[0], { t: "reveal", voted: 2, of: 2, everyone: true });
  const empty = voting({ players: [player("deb", { isDealer: true, plays: false })] });
  assert.deepEqual(
    dock(empty, "deb").actions[0],
    { t: "reveal", voted: 0, of: 0, everyone: false },
    "nobody here isn't everyone",
  );
});

test("voting: a dealer who plays gets a hand and the dealer buttons", () => {
  const room = withPlayers(voting({ settings: { ...view().settings, dealerPlays: true } }), (p) =>
    p.isDealer ? { plays: true } : {},
  );
  const d = dock(room, "deb", 3);
  assert.equal(title(d), "You picked 3 · tap another card to change");
  assert.equal(cards(d.body).length, 5);
  assert.deepEqual(
    d.actions.map((a) => a.t),
    ["reveal", "skip", "restart"],
  );
  assert.deepEqual(d.actions[0], { t: "reveal", voted: 0, of: 3, everyone: false });
});

const revealed = (extra: Partial<TableView> = {}) =>
  withPlayers(view({ phase: "revealed", round: 1, ticket: ticket("SD-1"), ...extra }), (p) =>
    p.id === "ann" ? { vote: 5, hasVoted: true } : p.id === "bob" ? { vote: 5, hasVoted: true } : {},
  );

test("revealed: the dealer's settle hand shows the votes, the favourite and 'Vote again'", () => {
  const d = dock(revealed(), "deb");
  assert.equal(title(d), "Tap the final points");
  assert.equal(d.body?.t, "settle");
  const five = cards(d.body).find((c) => c.value === 5);
  assert.deepEqual(
    five?.voters.map((p) => p.id),
    ["ann", "bob"],
  );
  assert.equal(five?.suggested, true, "two votes and no tie: most votes");
  assert.ok(
    cards(d.body).every((c) => !c.selected && !c.dimmed && c.press?.t === "settle"),
    "any card makes the call",
  );
  assert.deepEqual(d.actions, [{ t: "restart", label: "Vote again" }]);
});

test("revealed: no favourite on a tie or a single vote", () => {
  const tie = withPlayers(revealed(), (p) => (p.id === "bob" ? { vote: 3 } : {}));
  assert.ok(cards(dock(tie, "deb").body).every((c) => !c.suggested));
  const one = withPlayers(revealed(), (p) => (p.id === "bob" ? { vote: null, hasVoted: false } : {}));
  assert.ok(cards(dock(one, "deb").body).every((c) => !c.suggested));
});

test("revealed: a voter keeps their hand, with everyone's votes on it, to switch if they're talked round", () => {
  const room = withPlayers(revealed(), (p) => (p.id === "bob" ? { vote: 8 } : {}));
  const d = dock(room, "ann", 5);
  assert.equal(title(d), "You played 5 · talked round? Tap another card");
  assert.equal(d.body?.t, "change");
  const hand = d.body?.t === "change" ? d.body.cards : [];
  assert.deepEqual(
    hand.map((c) => [c.value, c.selected, c.voters.map((p) => p.id), c.press]),
    [
      [1, false, [], { t: "vote", value: 1 }],
      [2, false, [], { t: "vote", value: 2 }],
      [3, false, [], { t: "vote", value: 3 }],
      [5, true, ["ann"], null],
      [8, false, ["bob"], { t: "vote", value: 8 }],
    ],
  );
  assert.deepEqual(d.actions, []);
});

test("revealed: your switch shows in your hand right away, and the title says what you had", () => {
  const room = withPlayers(revealed(), (p) => (p.id === "ann" ? { revealedVote: 5, vote: 3 } : {}));
  // the server already has 3; you've just tapped 8 and it hasn't answered yet
  const d = dock(room, "ann", 8);
  assert.equal(title(d), "You switched from 5 to 8 · tap another to switch again");
  const hand = d.body?.t === "change" ? d.body.cards : [];
  assert.deepEqual(
    hand.find((c) => c.value === 8)?.voters.map((p) => p.id),
    ["ann"],
  );
  assert.deepEqual(hand.find((c) => c.value === 3)?.voters, []);
});

test("revealed: players with no card down see the spread of votes", () => {
  const d = dock(
    withPlayers(revealed(), (p) =>
      p.id === "bob" ? { vote: 8 } : p.id === "ann" ? { vote: null, hasVoted: false } : {},
    ),
    "ann",
  );
  assert.equal(title(d), "Here's how everyone voted");
  assert.equal(d.body?.t, "spread");
  assert.deepEqual(d.body?.t === "spread" && d.body.cards.map((c) => [c.value, c.voters.map((p) => p.id), c.final]), [
    [8, ["bob"], false],
  ]);
  assert.deepEqual(d.actions, []);
  const nobody = dock(view({ phase: "revealed", round: 1, ticket: ticket("SD-1") }), "ann");
  assert.deepEqual(nobody.body, { t: "spread", cards: [] }, "drawn as 'Nobody voted'");
});

const settled = (extra: Partial<TableView> = {}) => revealed({ phase: "settled", finalPoints: 5, ...extra });

test("settled: the call is lit, others dimmed, no favourite; tapping another changes it", () => {
  const d = dock(settled(), "deb");
  assert.equal(title(d), "Final: 5 points · tap a card to change it");
  const hand = cards(d.body);
  assert.deepEqual(
    hand.filter((c) => c.selected).map((c) => c.value),
    [5],
  );
  assert.deepEqual(
    hand.filter((c) => c.dimmed).map((c) => c.value),
    [1, 2, 3, 8],
  );
  assert.ok(hand.every((c) => !c.suggested));
  assert.equal(hand.find((c) => c.value === 5)?.press, null, "the call already is 5");
  assert.deepEqual(hand.find((c) => c.value === 3)?.press, { t: "settle", value: 3 });
});

test("settled: the next queued ticket, or the picker when the queue is empty, plus Jira", () => {
  assert.deepEqual(dock(settled(), "deb").actions, [{ t: "picker", main: true }]);
  const queued = settled({
    queue: [
      { key: "SD-1", summary: "", points: null, status: "" },
      { key: "SD-2", summary: "", points: null, status: "" },
    ],
    ticket: { ...ticket("SD-1"), url: "https://jira.example.com/browse/SD-1" },
  });
  assert.deepEqual(dock(queued, "deb").actions, [
    { t: "next", key: "SD-2" },
    { t: "picker", main: false },
    { t: "jira", url: "https://jira.example.com/browse/SD-1" },
  ]);
  const sneaky = settled({ ticket: { ...ticket("SD-1"), url: "javascript:alert(1)" } });
  assert.deepEqual(dock(sneaky, "deb").actions, [{ t: "picker", main: true }], "only http(s) links");
});

test("settled: players see the spread with the final call, even if nobody played it", () => {
  const d = dock(settled({ finalPoints: 3 }), "ann");
  assert.equal(title(d), "Final: 3 points");
  assert.deepEqual(d.body?.t === "spread" && d.body.cards.map((c) => [c.value, c.final, c.voters.length]), [
    [3, true, 0],
    [5, false, 2],
  ]);
  assert.deepEqual(d.actions, []);
});

test("each phase and round has its own key, so the dock plays its entrance again", () => {
  assert.equal(dock(voting(), "ann").key, "voting:1");
  assert.equal(dock(voting({ round: 2 }), "ann").key, "voting:2");
  assert.equal(dock(settled(), "ann").key, "settled:1");
});

test("someone not at the table yet gets the player's view", () => {
  assert.deepEqual(dock(view(), "zed").body, { t: "waiting", text: "The dealer is picking a ticket" });
  const d = dock(voting(), "zed");
  assert.deepEqual([d.title, d.body, d.actions], [null, null, []]);
});

test("only http(s) URLs are links", () => {
  assert.equal(safeUrl("https://x.example"), "https://x.example");
  assert.equal(safeUrl("HTTP://x.example"), "HTTP://x.example");
  assert.equal(safeUrl("javascript:alert(1)"), null);
  assert.equal(safeUrl("//x.example"), null);
  assert.equal(safeUrl(42), null);
});
