// Saves tables to DATA_DIR/rooms.json, so a deploy or restart doesn't wipe
// open tables. Players reconnect on their own: their browser keeps a seat token.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { TableState } from "../table/state.ts";
import type { Log } from "../table/table.ts";
import type { RoomStore } from "./store.ts";

/** Parses saved tables, dropping any that don't match today's format. */
export function parseSaved(text: string, log: Pick<Log, "error">): TableState[] {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    log.error("saved tables aren't valid JSON, starting fresh", e);
    return [];
  }
  if (!Array.isArray(raw)) return [];
  const tables: TableState[] = [];
  for (const r of raw) {
    const parsed = TableState.safeParse(r);
    if (parsed.success) tables.push(parsed.data);
    else log.error(`dropping a saved table in an old format (${(r as { code?: string })?.code ?? "?"})`);
  }
  return tables;
}

export function fileStore(dir: string, log: Log): RoomStore {
  const file = join(dir, "rooms.json");
  return {
    load() {
      try {
        return parseSaved(readFileSync(file, "utf8"), log);
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ENOENT") log.error("could not load saved rooms", e);
        return [];
      }
    },
    save(tables) {
      try {
        mkdirSync(dir, { recursive: true });
        // write then rename, so a crash mid-write never leaves a half-written file
        writeFileSync(file + ".tmp", JSON.stringify(tables));
        renameSync(file + ".tmp", file);
      } catch (e) {
        log.error("could not save rooms", e);
      }
    },
  };
}
