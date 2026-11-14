// Copying to the clipboard. When the browser won't (no permission, plain http), the text shows
// up in a kit dialog to select and copy by hand: never the browser's prompt().
import { createValue } from "../../../shared/value.ts";
import type { Toasts } from "../ui/index.ts";

export interface ClipboardLike {
  writeText(text: string): Promise<void>;
}

/** What to copy by hand, when the clipboard said no. */
export interface CopyFallback {
  title: string;
  text: string;
}

export interface CopyOptions {
  /** The toast once it's copied: "🔗 Invite link copied." */
  done: string;
  /** The fallback dialog's title: "Send this link to your team". */
  title: string;
}

export function createCopy(deps: { clipboard: () => ClipboardLike | undefined; toasts: Pick<Toasts, "show"> }) {
  const fallback = createValue<CopyFallback | null>(null);

  return {
    /** Copies `text`; true when it's on the clipboard, false when it went to the dialog instead. */
    async copy(text: string, { done, title }: CopyOptions): Promise<boolean> {
      try {
        const clipboard = deps.clipboard();
        if (!clipboard) throw new Error("no clipboard here");
        await clipboard.writeText(text);
        deps.toasts.show(done);
        return true;
      } catch {
        fallback.set({ title, text });
        return false;
      }
    },
    /** For useSyncExternalStore: what the fallback dialog shows, or null when it's closed. */
    fallback: fallback.get,
    subscribe: fallback.subscribe,
    dismiss: () => fallback.set(null),
  };
}

export type Copy = ReturnType<typeof createCopy>;
