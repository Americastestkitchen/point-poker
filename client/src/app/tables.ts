// Opening a table and checking one is still there: the two HTTP calls made before you sit down.
// Opening remembers the host passcode that worked and the dealer key, so a reload keeps you
// the dealer. The fetch is injected, so tests run it in node.
import { OpenedTable, TableInfo } from "../../../shared/protocol.ts";
import type { Storage } from "./storage.ts";

export type FetchLike = (
  url: string,
  init?: { method?: string; headers?: Record<string, string> },
) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

/** How opening a table went. */
export type OpenResult =
  | { t: "opened"; code: string }
  /** The server wants a (different) host passcode. `tried` says whether one was sent. */
  | { t: "passcode"; tried: boolean }
  | { t: "failed"; reason: string };

/** Whether an invite's table is still open; "unknown" when the server couldn't be asked. */
export type TableCheck = { t: "open"; info: TableInfo } | { t: "gone" } | { t: "unknown" };

export const OPEN_FAILED = "Couldn't open a table. Try again in a moment.";

export function createTables(deps: {
  fetch: FetchLike;
  storage: Pick<Storage, "hostPass" | "setHostPass" | "setDealerKey">;
}) {
  const { storage } = deps;
  return {
    /** The host passcode that worked last time ("" if none). */
    savedPasscode: () => storage.hostPass(),
    /** Opens a new table that you deal. */
    async open(passcode: string): Promise<OpenResult> {
      const res = await deps
        .fetch("/api/rooms", { method: "POST", headers: { "x-host-passcode": passcode } })
        .catch(() => null);
      if (!res) return { t: "failed", reason: OPEN_FAILED };
      if (res.status === 401) return { t: "passcode", tried: passcode !== "" };
      const opened = res.ok ? OpenedTable.safeParse(await res.json().catch(() => null)) : null;
      if (!opened?.success) return { t: "failed", reason: OPEN_FAILED };
      storage.setHostPass(passcode);
      storage.setDealerKey(opened.data.code, opened.data.dealerKey);
      return { t: "opened", code: opened.data.code };
    },
    /** Is table `code` still open? */
    async check(code: string): Promise<TableCheck> {
      const res = await deps.fetch(`/api/rooms/${encodeURIComponent(code)}`).catch(() => null);
      const info = res ? TableInfo.safeParse(await res.json().catch(() => null)) : null;
      if (!info?.success) return { t: "unknown" };
      return info.data.exists ? { t: "open", info: info.data } : { t: "gone" };
    },
  };
}

export type Tables = ReturnType<typeof createTables>;
