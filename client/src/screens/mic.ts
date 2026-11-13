// The mic button's brain: wraps the injected Mic (whose callbacks take one listener each) into
// something React reads with useSyncExternalStore. Loudness goes to the table through actions;
// the button's glow is written straight onto its element, never through React state.
import type { Actions } from "../app/actions.ts";
import type { Storage } from "../app/storage.ts";
import type { Mic, MicStatus } from "../audio/mic.ts";
import type { Toasts } from "../ui/index.ts";

export interface MicControlDeps {
  mic: Mic;
  storage: Pick<Storage, "mic" | "setMic">;
  actions: Pick<Actions, "talk">;
  toasts: Pick<Toasts, "show">;
  /** Runs `fn` after `ms`; returns a cancel. */
  after(ms: number, fn: () => void): () => void;
}

/** The CSS variable the meter writes (0..1) on the element given to `meter()`. */
export const MIC_LEVEL_VAR = "--mic-level";

export const MIC_TIP =
  "🎙️ Tip: turn on your mic (top right) and your bean's mouth moves when you talk. No audio is sent.";
export const MIC_FAILED = "Couldn't use the mic. Check your browser's permission for this site.";
const TIP_AFTER_MS = 4000;

/**
 * Takes over `mic`'s callbacks. Once you sit down (seated()) it starts listening if you had
 * the mic on last time; otherwise it tips you off about it after a few seconds.
 */
export function createMicControl({ mic, storage, actions, toasts, after }: MicControlDeps) {
  const listeners = new Set<() => void>();
  let meterEl: { style: { setProperty(name: string, value: string): void } } | null = null;

  mic.onLevel = (level) => actions.talk(level);
  mic.onMeter = (level) => meterEl?.style.setProperty(MIC_LEVEL_VAR, level.toFixed(2));
  mic.onStatus = (status) => {
    // remember it for next time once it's settled either way
    if (status !== "starting") storage.setMic(status === "on");
    for (const l of [...listeners]) l();
  };

  const start = () => mic.start().catch(() => void toasts.show(MIC_FAILED, { tone: "error" }));
  let cancelTip: (() => void) | null = null;

  return {
    /** For useSyncExternalStore. */
    status: (): MicStatus => mic.status,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    /** You sat down at a table: the mic comes back on if it was on, or the tip shows. Once only. */
    seated() {
      if (cancelTip) return;
      cancelTip = () => {};
      if (storage.mic()) void start();
      else cancelTip = after(TIP_AFTER_MS, () => void toasts.show(MIC_TIP));
    },
    /** On, or off. A press while the browser is still asking means "never mind". */
    toggle() {
      if (mic.status === "on" || mic.status === "starting") mic.stop();
      else void start();
    },
    /** A ref callback: the element whose `--mic-level` follows your voice. */
    meter(el: { style: { setProperty(name: string, value: string): void } } | null) {
      meterEl = el;
    },
    /** Lets go of the mic and the tip, without forgetting that you had it on. */
    dispose() {
      cancelTip?.();
      mic.onLevel = mic.onMeter = () => {};
      mic.onStatus = () => {};
      listeners.clear();
      meterEl = null;
      mic.stop();
    },
  };
}

export type MicControl = ReturnType<typeof createMicControl>;
