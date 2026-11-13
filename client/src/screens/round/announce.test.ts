import { test } from "node:test";
import assert from "node:assert/strict";
import { player, ticket, view, withPlayers } from "../../app/fixtures.ts";
import type { TableView } from "../../../../shared/protocol.ts";
import { announcementFor } from "./announce.ts";

const settledChange = { t: "settled", resettled: false } as const;
const settledView = (extra: Partial<TableView>, votes: Record<string, number> = { ann: 5, bob: 8 }) =>
  withPlayers(view({ phase: "settled", round: 1, ticket: ticket("SD-1"), finalPoints: 5, pot: 13, ...extra }), (p) => ({
    vote: votes[p.id] ?? null,
  }));

test("only dealt, revealed and settled are announced", () => {
  const room = view({ phase: "voting", round: 1, ticket: ticket("SD-1") });
  for (const t of ["synced", "ticketChanged", "allIn"] as const)
    assert.equal(announcementFor({ t }, room, "ann"), null);
  assert.equal(announcementFor({ t: "joined", player: player("cat") }, room, "ann"), null);
});

test("dealt: the new ticket's key and summary, briefly", () => {
  const a = announcementFor({ t: "dealt" }, view({ phase: "voting", round: 1, ticket: ticket("SD-7") }), "ann");
  assert.deepEqual(a, {
    kind: "deal",
    mine: false,
    kicker: "New ticket",
    title: "SD-7",
    amount: null,
    sub: "About SD-7",
    ms: 1800,
  });
  assert.equal(
    announcementFor({ t: "dealt" }, view({ phase: "voting", round: 1 }), "ann"),
    null,
    "nothing to say without a ticket",
  );
});

const revealedView = (votes: Record<string, number | null>) =>
  withPlayers(view({ phase: "revealed", round: 1, ticket: ticket("SD-1") }), (p) => ({ vote: votes[p.id] ?? null }));

test("revealed: everyone agreeing is a consensus", () => {
  const a = announcementFor({ t: "revealed" }, revealedView({ ann: 3, bob: 3 }), "ann");
  assert.equal(a?.title, "Everyone said 3! 🎉");
  assert.equal(a?.sub, "Consensus. Mark it on the calendar.");
  assert.equal(a?.ms, 1700);
  assert.equal(a?.kind, "reveal");
});

test("revealed: otherwise the range, or nobody picked; one vote isn't a consensus", () => {
  assert.deepEqual(
    [
      announcementFor({ t: "revealed" }, revealedView({ ann: 2, bob: 8 }), "ann")?.title,
      announcementFor({ t: "revealed" }, revealedView({ ann: 2, bob: 8 }), "ann")?.sub,
    ],
    ["Cards up!", "From 2 to 8"],
  );
  assert.equal(announcementFor({ t: "revealed" }, revealedView({ ann: 5 }), "ann")?.sub, "From 5 to 5");
  assert.equal(announcementFor({ t: "revealed" }, revealedView({ ann: 5 }), "ann")?.title, "Cards up!");
  assert.equal(announcementFor({ t: "revealed" }, revealedView({}), "ann")?.sub, "Nobody picked a card");
  // a dealer who sits out doesn't count, even with a stale vote
  const sitOut = withPlayers(revealedView({ ann: 3, bob: 3 }), (p) => (p.isDealer ? { vote: 8 } : {}));
  assert.equal(announcementFor({ t: "revealed" }, sitOut, "ann")?.title, "Everyone said 3! 🎉");
});

test("settled, house wins: the dealer rakes it in", () => {
  const room = settledView({ houseWon: true, winners: ["deb"], share: 13 });
  assert.deepEqual(announcementFor(settledChange, room, "deb"), {
    kind: "settle",
    mine: true,
    kicker: "Final call · 5 points",
    title: "House wins",
    amount: 13,
    sub: "Nobody was within one card of 5. You rake in the pot.",
    ms: 2800,
  });
  assert.deepEqual(announcementFor(settledChange, room, "ann"), {
    kind: "settle",
    mine: false,
    kicker: "Final call · 5 points",
    title: "House wins",
    amount: null,
    sub: "Nobody was within one card of 5. DEB rakes in 🪙 +13",
    ms: 2800,
  });
  const noDealer = { ...room, players: room.players.filter((p) => !p.isDealer) };
  assert.match(announcementFor(settledChange, noDealer, "ann")?.sub ?? "", /The dealer rakes in 🪙 \+13$/);
});

test("settled, nobody won: says why", () => {
  const nobodyPlayed = settledView({ pot: 0 }, {});
  assert.equal(announcementFor(settledChange, nobodyPlayed, "ann")?.sub, "Nobody picked a card.");
  assert.equal(
    announcementFor(settledChange, settledView({ pot: 13 }), "ann")?.sub,
    "Nobody was within one card of 5.",
  );
  assert.equal(
    announcementFor(settledChange, settledView({ pot: 0 }), "ann")?.sub,
    "Nobody was close, but the pot was empty anyway.",
  );
  const a = announcementFor(settledChange, settledView({}), "ann");
  assert.deepEqual(
    [a?.title, a?.kicker, a?.ms, a?.mine, a?.amount],
    ["House wins", "Final call · 5 points", 2600, false, null],
  );
});

test("settled, you won: alone, or split", () => {
  const alone = announcementFor(settledChange, settledView({ winners: ["ann"], share: 13 }), "ann");
  assert.deepEqual(alone, {
    kind: "settle",
    mine: true,
    kicker: "Final call · 5 points",
    title: "You win",
    amount: 13,
    sub: "The whole pot is yours",
    ms: 2800,
  });
  const split = announcementFor(settledChange, settledView({ winners: ["ann", "bob"], share: 6.5 }), "ann");
  assert.deepEqual([split?.title, split?.amount, split?.sub, split?.mine], ["You win", 6.5, "Split with BOB", true]);
});

test("settled, someone else won: alone, or split", () => {
  const alone = announcementFor(settledChange, settledView({ winners: ["ann"], share: 13 }), "bob");
  assert.deepEqual(alone, {
    kind: "settle",
    mine: false,
    kicker: "Final call · 5 points",
    title: "ANN takes the pot",
    amount: null,
    sub: "🪙 +13",
    ms: 2600,
  });
  const split = announcementFor(settledChange, settledView({ winners: ["ann", "bob"], share: 6.5 }), "deb");
  assert.deepEqual([split?.title, split?.sub], ["ANN & BOB split the pot", "🪙 +6.5 each"]);
});

test("a changed call is announced again", () => {
  const a = announcementFor({ t: "settled", resettled: true }, settledView({ winners: ["ann"], share: 13 }), "bob");
  assert.equal(a?.title, "ANN takes the pot");
});
