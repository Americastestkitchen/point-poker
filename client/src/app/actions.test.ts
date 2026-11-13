import { test } from "node:test";
import assert from "node:assert/strict";
import type { Command } from "../../../server/table/commands.ts";
import type { ClientFx } from "../../../shared/protocol.ts";
import { createActions } from "./actions.ts";
import type { GameEvent } from "./events.ts";
import { ticket, view, withPlayers } from "./fixtures.ts";
import { createStore } from "./store.ts";

/** A fake session: records what would have gone over the wire and answers with `reply`. */
function setup(me = "ann", reply: (cmd: Command) => string | undefined = () => undefined) {
  const sent: (Command | ClientFx)[] = [];
  const store = createStore();
  const events: GameEvent[] = [];
  store.events.on((e) => events.push(e));
  const session = {
    request: (cmd: Command) => {
      sent.push(cmd);
      const error = reply(cmd);
      return error ? Promise.reject(new Error(error)) : Promise.resolve();
    },
    fx: (fx: ClientFx) => void sent.push(fx),
  };
  const actions = createActions(session, store);
  store.welcomed(me);
  store.receive(view({ phase: "voting", round: 1, ticket: ticket("SD-1") }));
  events.length = 0;
  return { sent, store, events, actions };
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
});

test("your card comes from your view, so a fresh page still knows it", () => {
  const { store } = setup();
  const mine = view({ phase: "voting", round: 1, ticket: ticket("SD-1") });
  mine.players = mine.players.map((p) => (p.id === "ann" ? { ...p, hasVoted: true, vote: 5 } : p));
  store.receive(mine);
  assert.equal(store.getState().ui.myVote, 5);
  store.receive(view({ phase: "voting", round: 2, ticket: ticket("SD-1") }));
  assert.equal(store.getState().ui.myVote, null, "a new round starts empty-handed");
});

test("a view from before your vote arrived doesn't take your card back", async () => {
  let answer!: (error?: string) => void;
  const { store, events } = setup();
  // a session whose reply we hold back until we say so
  const held = createActions({
    request: () => new Promise<void>((resolve, reject) => (answer = (error) => (error ? reject(new Error(error)) : resolve()))),
    fx: () => {},
  }, store);
  const voting = view({ phase: "voting", round: 1, ticket: ticket("SD-1") });
  held.vote(3);
  store.receive(voting); // sent before the server got the vote
  assert.equal(store.getState().ui.myVote, 3);
  store.receive(withPlayers(voting, (p) => (p.id === "ann" ? { hasVoted: true, vote: 3 } : {})));
  answer();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(store.getState().ui.myVote, 3);

  held.vote(5);
  answer("Voting is over");
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(store.getState().ui.myVote, 3, "a refused vote puts your card back");
  assert.deepEqual(events.at(-1), { t: "toast", text: "Voting is over", level: "error" });
});

test("dealer actions resolve when the server says yes and reject with its reason", async () => {
  const { sent, actions } = setup("deb", (cmd) => (cmd.t === "loadTicket" && cmd.ref === "SD-404" ? "SD-404: Ticket not found (or no access)" : undefined));
  await actions.dealer.load("SD-7");
  await assert.rejects(actions.dealer.load("SD-404"), { message: "SD-404: Ticket not found (or no access)" });
  await actions.dealer.reveal();
  await actions.dealer.settle(5);
  await actions.dealer.next();
  await actions.dealer.kick("bob");
  assert.deepEqual(sent, [
    { t: "loadTicket", ref: "SD-7" },
    { t: "loadTicket", ref: "SD-404" },
    { t: "reveal" },
    { t: "settle", finalPoints: 5 },
    { t: "nextRound" },
    { t: "kick", id: "bob" },
  ]);
});

test("a failed action nobody waits on becomes a toast; a flick that's too soon stays quiet", async () => {
  const { events, actions } = setup("ann", (cmd) => (cmd.t === "flick" ? "Not so fast" : cmd.t === "setLook" ? "Nope" : undefined));
  actions.flick("bob");
  actions.setLook({ color: "#ffd23f", body: "pear", cosmetics: [] });
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(events, [{ t: "toast", text: "Nope", level: "error" }]);
});

test("small talk goes out as effects", () => {
  const { sent, events, actions } = setup();
  actions.emote("wave");
  actions.gaze(0.2, -0.1);
  actions.talk(0.5);
  actions.openTicket();
  assert.deepEqual(sent, [{ kind: "emote", emote: "wave" }, { kind: "gaze", yaw: 0.2, pitch: -0.1 }, { kind: "talk", level: 0.5 }]);
  assert.deepEqual(events, [{ t: "openTicket" }]);
});
