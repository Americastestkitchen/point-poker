import { test } from "node:test";
import assert from "node:assert/strict";
import { createMic, nextMicStatus, type MicInput } from "./mic.ts";

/** A microphone that answers when we say so, at a loudness we set. */
function fakeMic() {
  const asks: { grant(): void; refuse(): void }[] = [];
  const input = { loudness: 0, closed: 0, rms() { return this.loudness; }, close() { this.closed++; } };
  const open = () => new Promise<MicInput>((resolve, reject) =>
    asks.push({ grant: () => resolve(input), refuse: () => reject(new Error("NotAllowedError")) }));
  return { asks, input, open };
}

const settle = () => new Promise((r) => setImmediate(r));

test("the rules: one request at a time, and a stop while asking wins", () => {
  assert.equal(nextMicStatus("off", "start"), "starting");
  assert.equal(nextMicStatus("starting", "start"), "starting");
  assert.equal(nextMicStatus("starting", "granted"), "on");
  assert.equal(nextMicStatus("starting", "refused"), "denied");
  assert.equal(nextMicStatus("denied", "start"), "starting");
  assert.equal(nextMicStatus("starting", "stop"), "off");
  assert.equal(nextMicStatus("off", "granted"), "off", "a late yes after a stop changes nothing");
});

test("starting twice while the browser asks only asks once", async () => {
  const { asks, input, open } = fakeMic();
  const mic = createMic(open);
  const seen: string[] = [];
  mic.onStatus = (s) => seen.push(s);
  void mic.start();
  void mic.start();
  assert.equal(asks.length, 1);
  asks[0].grant();
  await settle();
  assert.deepEqual(seen, ["starting", "on"]);
  mic.stop();
  assert.equal(input.closed, 1);
  assert.equal(mic.status, "off");
});

test("stopping while the browser asks lets the mic go when it says yes", async () => {
  const { asks, input, open } = fakeMic();
  const mic = createMic(open);
  void mic.start();
  mic.stop();
  asks[0].grant();
  await settle();
  assert.equal(mic.status, "off");
  assert.equal(input.closed, 1);
});

test("after start, stop, start, only the newest request counts", async () => {
  const { asks, input, open } = fakeMic();
  const mic = createMic(open);
  void mic.start();
  mic.stop();
  void mic.start();
  asks[0].grant();
  await settle();
  assert.equal(mic.status, "starting", "the cancelled request's yes is let go");
  assert.equal(input.closed, 1);
  asks[1].grant();
  await settle();
  assert.equal(mic.status, "on");

  const again = fakeMic();
  const mic2 = createMic(again.open);
  void mic2.start();
  mic2.stop();
  const second = mic2.start();
  again.asks[0].refuse();
  await settle();
  assert.equal(mic2.status, "starting", "the cancelled request's no is ignored");
  again.asks[1].grant();
  await second;
  assert.equal(mic2.status, "on");
  mic.stop();
  mic2.stop();
});

test("stopping from the status callback when it turns on stops it", async () => {
  const { asks, input, open } = fakeMic();
  const mic = createMic(open);
  mic.onStatus = (s) => { if (s === "on") mic.stop(); };
  void mic.start();
  asks[0].grant();
  await settle();
  assert.equal(mic.status, "off");
  assert.equal(input.closed, 1);
});

test("stopping from the status callback while it starts never asks the browser", async () => {
  const { asks, open } = fakeMic();
  const mic = createMic(open);
  mic.onStatus = (s) => { if (s === "starting") mic.stop(); };
  await mic.start();
  assert.equal(asks.length, 0);
  assert.equal(mic.status, "off");
});

test("a refused mic says so, and you can ask again", async () => {
  const { asks, open } = fakeMic();
  const mic = createMic(open);
  const first = mic.start();
  asks[0].refuse();
  await assert.rejects(first, /NotAllowedError/);
  assert.equal(mic.status, "denied");
  void mic.start();
  assert.equal(asks.length, 2);
  assert.equal(mic.status, "starting");
});

test("loudness goes out in steps, with one zero when you go quiet", async (t) => {
  t.mock.timers.enable({ apis: ["setInterval"] });
  const { asks, input, open } = fakeMic();
  const mic = createMic(open);
  const levels: number[] = [];
  mic.onLevel = (l) => levels.push(l);
  void mic.start();
  asks[0].grant();
  await settle();
  input.loudness = 0.1; // loud
  t.mock.timers.tick(80 * 4);
  input.loudness = 0; // quiet
  t.mock.timers.tick(80 * 12);
  assert.ok(levels.length >= 2 && levels.slice(0, -1).every((l) => l > 0), `levels: ${levels}`);
  assert.equal(levels.at(-1), 0);
  mic.stop();
});
