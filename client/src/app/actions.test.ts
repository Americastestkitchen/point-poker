import { test } from "node:test";
import assert from "node:assert/strict";
import type { ClientMsg } from "../../../shared/protocol.ts";
import { createActions, FLICK_COOLDOWN_MS } from "./actions.ts";
import type { GameEvent } from "./events.ts";
import { ticket, view, withPlayers } from "./fixtures.ts";
import { createStore } from "./store.ts";

/** A fake session that records what would have gone over the wire. */
function setup(me = "ann") {
  const sent: ClientMsg[] = [];
  const store = createStore();
  const events: GameEvent[] = [];
  store.events.on((e) => events.push(e));
  let now = 1000;
  const clock = { now: () => now };
  const actions = createActions({ send: (m) => sent.push(m) }, store, clock);
  store.setState({ me: { id: me, isDealer: me === "deb" } });
  store.receive(view({ phase: "voting", round: 1, ticket: ticket("SD-1") }));
  events.length = 0;
  return { sent, store, events, actions, tick: (ms: number) => (now += ms) };
}

test("playing a card sends the vote, remembers it and tells the scene", () => {
  const { sent, store, events, actions } = setup();
  actions.vote(3);
  assert.deepEqual(sent, [{ t: "vote", value: 3 }]);
  assert.equal(store.getState().ui.myVote, 3);
  assert.deepEqual(events, [{ t: "played", value: 3, changed: false }]);
  actions.vote(3);
  assert.equal(sent.length, 1, "the same card again does nothing");
  actions.vote(5);
  assert.deepEqual(events.at(-1), { t: "played", value: 5, changed: true });
});

test("no voting outside a round, or for a dealer who sits out", () => {
  const { sent, store, actions } = setup();
  store.receive(view({ phase: "revealed", round: 1 }));
  actions.vote(3);
  const dealer = setup("deb");
  dealer.actions.vote(3);
  assert.deepEqual([...sent, ...dealer.sent], []);
  assert.equal(store.getState().ui.myVote, null);
});

test("your vote is forgotten when a new round starts, or when the server says you haven't voted", () => {
  const { store, actions } = setup();
  actions.vote(3);
  store.receive(withPlayers(view({ phase: "voting", round: 1, ticket: ticket("SD-1") }), (p) => ({ hasVoted: p.id === "ann" })));
  assert.equal(store.getState().ui.myVote, 3);
  store.receive(view({ phase: "voting", round: 2, ticket: ticket("SD-1") }));
  assert.equal(store.getState().ui.myVote, null);
});

test("chip flicks are rate-limited", () => {
  const { sent, actions, tick } = setup();
  actions.flick("bob");
  actions.flick("bob");
  tick(FLICK_COOLDOWN_MS);
  actions.flick("deb");
  assert.deepEqual(sent, [{ t: "flick", target: "bob" }, { t: "flick", target: "deb" }]);
});

test("dealer actions become the matching commands", () => {
  const { sent, actions } = setup("deb");
  actions.dealer.load("SD-7");
  actions.dealer.typeIn("Fix the thing");
  actions.dealer.reveal();
  actions.dealer.settle(5);
  actions.dealer.next();
  actions.dealer.kick("bob");
  assert.deepEqual(sent, [
    { t: "loadTicket", ref: "SD-7" },
    { t: "manualTicket", key: "", summary: "Fix the thing", description: "" },
    { t: "reveal" },
    { t: "settle", finalPoints: 5 },
    { t: "nextRound" },
    { t: "kick", id: "bob" },
  ]);
});

test("small talk goes out as effects", () => {
  const { sent, events, actions } = setup();
  actions.emote("wave");
  actions.gaze(0.2, -0.1);
  actions.talk(0.5);
  actions.openTicket();
  assert.deepEqual(sent, [{ t: "emote", kind: "wave" }, { t: "look", yaw: 0.2, pitch: -0.1 }, { t: "talk", level: 0.5 }]);
  assert.deepEqual(events, [{ t: "openTicket" }]);
});
