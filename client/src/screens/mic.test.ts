import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryStorage, createStorage } from "../app/storage.ts";
import { createMic, type MicInput } from "../audio/mic.ts";
import { createMicControl, MIC_FAILED, MIC_LEVEL_VAR, MIC_TIP } from "./mic.ts";

const settle = () => new Promise((r) => setImmediate(r));

function setup({ savedOn = false, allow = true } = {}) {
  const storage = createStorage(memoryStorage());
  if (savedOn) storage.setMic(true);
  const input: MicInput = { rms: () => 0, close() {} };
  let asks = 0;
  const mic = createMic(async () => {
    asks++;
    if (!allow) throw new Error("NotAllowedError");
    return input;
  });
  const toasts: { text: string; tone?: string }[] = [];
  const talked: number[] = [];
  const timers: { ms: number; fn: () => void; cancelled: boolean }[] = [];
  const control = createMicControl({
    mic,
    storage,
    actions: { talk: (level) => void talked.push(level) },
    toasts: {
      show: (text, o) => {
        toasts.push({ text, tone: o?.tone });
        return toasts.length;
      },
    },
    after: (ms, fn) => {
      const t = { ms, fn, cancelled: false };
      timers.push(t);
      return () => void (t.cancelled = true);
    },
  });
  return { storage, mic, control, toasts, talked, timers, asks: () => asks };
}

test("no mic last time: a tip after a few seconds, and nothing asked for", () => {
  const { control, toasts, timers, asks } = setup();
  assert.equal(asks(), 0);
  assert.equal(control.status(), "off");
  assert.equal(timers.length, 1);
  assert.equal(timers[0]?.ms, 4000);
  timers[0]?.fn();
  assert.deepEqual(toasts, [{ text: MIC_TIP, tone: undefined }]);
});

test("mic on last time: it starts by itself, with no tip", async () => {
  const { control, timers, asks } = setup({ savedOn: true });
  assert.equal(asks(), 1);
  assert.equal(timers.length, 0);
  await settle();
  assert.equal(control.status(), "on");
  control.dispose();
});

test("toggling tells React, and is remembered once it settles", async () => {
  const { control, storage } = setup();
  let changes = 0;
  const stop = control.subscribe(() => changes++);
  control.toggle();
  assert.equal(control.status(), "starting");
  assert.equal(storage.mic(), false, "not remembered while the browser is still asking");
  await settle();
  assert.equal(control.status(), "on");
  assert.equal(storage.mic(), true);
  control.toggle();
  assert.equal(control.status(), "off");
  assert.equal(storage.mic(), false);
  assert.equal(changes, 3, "starting, on, off");
  stop();
  control.toggle();
  assert.equal(changes, 3, "unsubscribed");
  await settle();
  control.dispose();
});

test("a refused mic says why, as an error toast", async () => {
  const { control, toasts } = setup({ allow: false });
  control.toggle();
  await settle();
  assert.equal(control.status(), "denied");
  assert.deepEqual(toasts, [{ text: MIC_FAILED, tone: "error" }]);
});

test("loudness goes to the table, and the meter onto the element", async () => {
  const { control, mic, talked } = setup();
  const props = new Map<string, string>();
  control.meter({ style: { setProperty: (k, v) => void props.set(k, v) } });
  mic.onMeter(0.256);
  mic.onLevel(0.3);
  assert.equal(props.get(MIC_LEVEL_VAR), "0.26");
  assert.deepEqual(talked, [0.3]);
  control.meter(null);
  mic.onMeter(0.9);
  assert.equal(props.get(MIC_LEVEL_VAR), "0.26", "no element, no writes");
});

test("dispose lets the mic go, cancels the tip, and keeps 'on' for next time", async () => {
  const { control, timers, storage } = setup();
  control.toggle();
  await settle();
  control.dispose();
  assert.equal(timers[0]?.cancelled, true);
  assert.equal(control.status(), "off");
  assert.equal(storage.mic(), true, "leaving the page isn't turning the mic off");
});
