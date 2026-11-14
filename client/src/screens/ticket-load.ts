// Fetching a ticket for the table: the dock's "Next ticket", the dealer panel's "Skip" and the
// picker all share it. The picker shows the spinner and any failure; the latest load wins.
import { errorMessage } from "../../../shared/errors.ts";
import { createValue } from "../../../shared/value.ts";

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
  const state = createValue<TicketLoadState>(idle);
  let latest = 0;

  return {
    /** For useSyncExternalStore. */
    get: state.get,
    subscribe: state.subscribe,
    /**
     * Shows `text` while `work` runs. A failure opens the picker with the reason and bonks.
     * Only the latest run counts: an older one finishing later changes nothing.
     */
    run(work: Promise<void>, text: string): void {
      const mine = ++latest;
      state.set({ status: "loading", text });
      work.then(
        () => {
          if (mine === latest) state.set(idle);
        },
        (e: unknown) => {
          if (mine !== latest) return;
          state.set({ status: "failed", reason: errorMessage(e) });
          openPicker();
          bonk();
        },
      );
    },
    /** Forget a failure (the dealer is typing again). A load in flight keeps going. */
    clear() {
      if (state.get().status === "failed") state.set(idle);
    },
  };
}

export type TicketLoad = ReturnType<typeof createTicketLoad>;
