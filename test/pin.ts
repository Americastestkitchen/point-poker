// For tests that pin positions with Node's snapshots (the *.test.ts.snapshot
// file next to the test), so nothing moves by accident. Moved something on
// purpose? Run `npm run test:update-snapshots` and commit the snapshot.
import type { TestContext } from "node:test";

/** Lists of numbers go on one line, rounded so float noise never counts as a move. */
const serialize = (value: unknown) =>
  JSON.stringify(value, (_, v) => (Array.isArray(v) && v.every((n) => typeof n === "number") ? v.map((n) => +n.toFixed(9)).join(", ") : v), 2);

/** Fails if `value` differs from the snapshot, saying how to re-pin it if the move was intended. */
export function pin(t: TestContext, value: unknown): void {
  try {
    t.assert.snapshot(value, { serializers: [serialize] });
  } catch (cause) {
    throw new Error("Pinned positions changed. If you moved this on purpose, run `npm run test:update-snapshots` and commit the updated .snapshot file.", { cause });
  }
}
