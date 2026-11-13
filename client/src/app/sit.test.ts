import { test } from "node:test";
import assert from "node:assert/strict";
import { createSit } from "./sit.ts";
import { createStore } from "./store.ts";

test("sitting down shows the invite, moves to the table and joins, once", () => {
  const store = createStore();
  const did: string[] = [];
  const sit = createSit({
    store,
    session: { join: (code) => void did.push(`join ${code}`) },
    showInvite: (code) => void did.push(`invite ${code}`),
  });
  sit("ABCD");
  assert.equal(store.getState().screen, "table");
  sit("WXYZ");
  assert.deepEqual(did, ["invite ABCD", "join ABCD"], "already seated: the second table is ignored");
});
