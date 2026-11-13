// Fetching a ticket for the table: the dock's "Next ticket", the dealer panel's "Skip" and the
// picker all share it. The picker shows the spinner and any failure; the latest load wins.

export type TicketLoadState =
  | { status: "idle" }
  /** Waiting on the server (and maybe Jira); `text` says what for: "Fetching SD-12 from Jira…". */
  | { status: "loading"; text: string }
  /** The server said no; `reason` is its human-readable why. */
  | { status: "failed"; reason: string };

export interface TicketLoadDeps {
  /** Shows the picker, where the failure is explained. */
  openPicker(): void;
  /** The "that didn't work" sound. */
  bonk(): void;
}

const idle: TicketLoadState = { status: "idle" };

export function createTicketLoad({ openPicker, bonk }: TicketLoadDeps) {
  let state: TicketLoadState = idle;
  let latest = 0;
  const listeners = new Set<() => void>();
  const set = (next: TicketLoadState) => {
    state = next;
    for (const l of [...listeners]) l();
  };

  return {
    /** For useSyncExternalStore. */
    get: (): TicketLoadState => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    /**
     * Shows `text` while `work` runs. A failure opens the picker with the reason and bonks.
     * Only the latest run counts: an older one finishing later changes nothing.
     */
    run(work: Promise<void>, text: string): void {
      const mine = ++latest;
      set({ status: "loading", text });
      work.then(
        () => { if (mine === latest) set(idle); },
        (e: unknown) => {
          if (mine !== latest) return;
          set({ status: "failed", reason: e instanceof Error ? e.message : String(e) });
          openPicker();
          bonk();
        },
      );
    },
    /** Forget a failure (the dealer is typing again). A load in flight keeps going. */
    clear() {
      if (state.status === "failed") set(idle);
    },
  };
}

export type TicketLoad = ReturnType<typeof createTicketLoad>;
