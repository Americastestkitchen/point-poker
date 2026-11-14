// The toast queue behind <Toaster>: a tiny store that React reads with useSyncExternalStore.
import { createValue } from "../../../shared/value.ts";

export type ToastTone = "info" | "success" | "error";

export interface ToastItem {
  id: number;
  text: string;
  tone: ToastTone;
}

export interface ToastOptions {
  tone?: ToastTone;
  /** How long it stays up, in ms. */
  ms?: number;
}

export interface Scheduler {
  after(ms: number, fn: () => void): void;
}

const browserScheduler: Scheduler = { after: (ms, fn) => void setTimeout(fn, ms) };

/** At most this many are shown; a new one pushes the oldest out. */
export const MAX_TOASTS = 4;

export function createToasts(scheduler: Scheduler = browserScheduler) {
  const items = createValue<readonly ToastItem[]>([]);
  let nextId = 1;

  const toasts = {
    show(text: string, { tone = "info", ms = 3200 }: ToastOptions = {}): number {
      const id = nextId++;
      items.set([...items.get(), { id, text, tone }].slice(-MAX_TOASTS));
      scheduler.after(ms, () => toasts.dismiss(id));
      return id;
    },
    dismiss(id: number) {
      const now = items.get();
      if (now.some((t) => t.id === id)) items.set(now.filter((t) => t.id !== id));
    },
    get: items.get,
    subscribe: items.subscribe,
  };
  return toasts;
}

export type Toasts = ReturnType<typeof createToasts>;
