// The toast queue behind <Toaster>: a tiny store that React reads with useSyncExternalStore.

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
  let items: readonly ToastItem[] = [];
  let nextId = 1;
  const listeners = new Set<() => void>();
  const set = (next: readonly ToastItem[]) => {
    items = next;
    for (const l of listeners) l();
  };

  const toasts = {
    show(text: string, { tone = "info", ms = 3200 }: ToastOptions = {}): number {
      const id = nextId++;
      set([...items, { id, text, tone }].slice(-MAX_TOASTS));
      scheduler.after(ms, () => toasts.dismiss(id));
      return id;
    },
    dismiss(id: number) {
      if (items.some((t) => t.id === id)) set(items.filter((t) => t.id !== id));
    },
    get: () => items,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
  return toasts;
}

export type Toasts = ReturnType<typeof createToasts>;
