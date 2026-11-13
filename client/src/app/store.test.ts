import { test } from "node:test";
import assert from "node:assert/strict";
import { player, view } from "./fixtures.ts";
import { createStore } from "./store.ts";

test("a view arrives together with what changed in it", () => {
  const store = createStore();
  const seen: unknown[] = [];
  store.subscribe((s, prev) => { if (s.room !== prev.room) seen.push([s.room?.round, s.changes.map((c) => c.t)]); });
  const streamed: unknown[] = [];
  store.events.on((e) => streamed.push(e));

  const first = view({ phase: "waiting", round: 0 });
  store.receive(first);
  store.receive(view({ phase: "voting", round: 1, players: [...first.players, player("cat", { seat: 2 })] }));
  assert.deepEqual(seen, [[0, ["synced"]], [1, ["joined", "dealt"]]]);
  assert.deepEqual(streamed, [], "view changes don't go on the event stream");
});
