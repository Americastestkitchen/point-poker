import { test } from "node:test";
import assert from "node:assert/strict";
import { createCopy, type ClipboardLike } from "./copy.ts";

function setup(clipboard: ClipboardLike | undefined) {
  const toasts: string[] = [];
  const copy = createCopy({ clipboard: () => clipboard, toasts: { show: (t) => toasts.push(t) } });
  return { copy, toasts };
}
const opts = { done: "🔗 Invite link copied.", title: "Send this link to your team" };

test("copied: a toast, and no dialog", async () => {
  const written: string[] = [];
  const { copy, toasts } = setup({ writeText: async (t) => void written.push(t) });
  assert.equal(await copy.copy("https://pp.example/?room=ABCD", opts), true);
  assert.deepEqual(written, ["https://pp.example/?room=ABCD"]);
  assert.deepEqual(toasts, ["🔗 Invite link copied."]);
  assert.equal(copy.fallback(), null);
});

test("the clipboard says no: the text shows in the dialog to copy by hand", async () => {
  const { copy, toasts } = setup({ writeText: () => Promise.reject(new Error("NotAllowedError")) });
  let changes = 0;
  copy.subscribe(() => changes++);
  assert.equal(await copy.copy("SD-1\t5 pts", opts), false);
  assert.deepEqual(copy.fallback(), { title: "Send this link to your team", text: "SD-1\t5 pts" });
  assert.deepEqual(toasts, []);
  copy.dismiss();
  copy.dismiss();
  assert.equal(copy.fallback(), null);
  assert.equal(changes, 2);
});

test("no clipboard at all (plain http) falls back too", async () => {
  const { copy } = setup(undefined);
  assert.equal(await copy.copy("x", opts), false);
  assert.equal(copy.fallback()?.text, "x");
});
