import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "./app.ts";
import { passcodeAuth } from "./auth/dealer.ts";
import { memoryStore } from "./store/memory.ts";
import { noTickets } from "./tickets/none.ts";

test("a request that throws gets a 500 and the server keeps serving", async () => {
  const errors: unknown[][] = [];
  const app = createApp({
    store: memoryStore(),
    auth: passcodeAuth(""),
    distDir: mkdtempSync(join(tmpdir(), "pp-dist-")),
    ticketsFor: noTickets,
    now: Date.now,
    random: Math.random,
    log: { info() {}, error: (...args) => errors.push(args) },
  });
  await new Promise<void>((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  const { port } = app.server.address() as AddressInfo;
  try {
    // "%" alone is a malformed escape: decoding the path throws.
    const bad = await fetch(`http://127.0.0.1:${port}/%`, { signal: AbortSignal.timeout(2000) });
    assert.equal(bad.status, 500);
    assert.equal(errors.length, 1);
    const ok = await fetch(`http://127.0.0.1:${port}/api/rooms/NOPE`);
    assert.equal(ok.status, 404);
  } finally {
    await new Promise((resolve) => app.server.close(resolve));
  }
});
