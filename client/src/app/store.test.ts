import { test } from "node:test";
import assert from "node:assert/strict";
import { player, view } from "./fixtures.ts";
import { createStore } from "./store.ts";

test("a view arrives together with what changed in it", () => {
  const store = createStore();
  const seen: unknown[] = [];
  store.subscribe((s, prev) => {
    if (s.room !== prev.room) seen.push([s.room?.round, s.changes.map((c) => c.t)]);
  });
  const streamed: unknown[] = [];
  store.events.on((e) => streamed.push(e));

  const first = view({ phase: "waiting", round: 0 });
  store.receive(first);
  store.receive(view({ phase: "voting", round: 1, players: [...first.players, player("cat", { seat: 2 })] }));
  assert.deepEqual(seen, [
    [0, ["synced"]],
    [1, ["joined", "dealt"]],
  ]);
  assert.deepEqual(streamed, [], "view changes don't go on the event stream");
});

test("one popup at a time: opening one replaces the other, and a stale close is ignored", () => {
  const store = createStore();
  let writes = 0;
  store.subscribe(() => writes++);
  assert.equal(store.getState().ui.popup, null);

  store.popupOpened("menu");
  store.popupOpened("menu");
  assert.equal(store.getState().ui.popup, "menu");
  assert.equal(writes, 1, "opening the open one again changes nothing");

  store.popupOpened("help");
  assert.equal(store.getState().ui.popup, "help", "the menu made way for how to play");
  store.popupClosed("menu");
  assert.equal(store.getState().ui.popup, "help", "the menu's late close doesn't shut how to play");
  store.popupClosed("help");
  assert.equal(store.getState().ui.popup, null);
  assert.equal(writes, 3);
});

test("popups leave the rest of the UI state alone", () => {
  const store = createStore();
  store.setUi({ lookOpen: true });
  store.popupOpened("leaderboard");
  assert.deepEqual(store.getState().ui, { myVote: null, votesInFlight: 0, lookOpen: true, popup: "leaderboard" });
});

test("the showcase only changes when where or how the bean shows changes", () => {
  const store = createStore();
  let writes = 0;
  store.subscribe(() => writes++);
  const look = { color: "#ffd23f", body: "bean", cosmetics: ["tophat"] } as const;
  const shown = {
    look: { ...look, cosmetics: [...look.cosmetics] },
    dealer: false,
    rect: { x: 10, y: 20, width: 300, height: 400 },
  };

  store.showcased(shown);
  store.showcased({ ...shown, rect: { ...shown.rect } });
  assert.equal(writes, 1, "the same box and look again is not a change");

  store.showcased({ ...shown, rect: { ...shown.rect, width: 320 } });
  assert.equal(store.getState().showcase?.rect.width, 320);
  store.showcased(null);
  assert.equal(store.getState().showcase, null);
  store.showcased(null);
  assert.equal(writes, 3);
});
