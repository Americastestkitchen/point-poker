// Keeps tables in memory only (local dev, previews, tests). Saved as JSON
// text anyway, so it behaves exactly like the file store.
import type { RoomStore } from "./store.ts";
import { parseSaved } from "./file.ts";

export function memoryStore(): RoomStore & { readonly saved: string } {
  let saved = "[]";
  return {
    get saved() {
      return saved;
    },
    load: () => parseSaved(saved, console),
    save: (tables) => {
      saved = JSON.stringify(tables);
    },
  };
}
