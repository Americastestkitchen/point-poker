import { test } from "node:test";
import assert from "node:assert/strict";
import { createValue } from "./value.ts";

test("a value tells its listeners when it changes, and only then", () => {
  const v = createValue<readonly number[]>([]);
  const first = v.get();
  assert.equal(v.get(), first, "the same value between changes");
  let heard = 0;
  const stop = v.subscribe(() => heard++);
  v.set(first);
  assert.equal(heard, 0, "unchanged: nobody is told");
  v.set([1]);
  assert.deepEqual(v.get(), [1]);
  assert.equal(heard, 1);
  stop();
  v.set([2]);
  assert.equal(heard, 1, "unsubscribed");
});

test("a listener may unsubscribe while being told, and the rest still hear it", () => {
  const v = createValue(0);
  const heard: string[] = [];
  const stopA = v.subscribe(() => {
    heard.push("a");
    stopA();
  });
  v.subscribe(() => heard.push("b"));
  v.set(1);
  v.set(2);
  assert.deepEqual(heard, ["a", "b", "b"]);
});
