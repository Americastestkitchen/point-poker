// Opening a table and checking one is still there: the HTTP calls made before you sit down,
// plus the dealer's Jira sign-in (asking who's signed in, and signing out). Opening remembers
// the host passcode that worked, the Jira site you picked and the dealer key, so a reload keeps
// you the dealer. The fetch is injected, so tests run it in node.
import {
  HostInfo,
  OpenedTable,
  OpenRefusal,
  TableInfo,
  type JiraSite,
  type OpenRequest,
} from "../../../shared/protocol.ts";
import type { Storage } from "./storage.ts";

export type FetchLike = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
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
  /** Sign in with Jira first. */
  | { t: "signIn" }
  /** You have more than one Jira site: pick the one this table uses. */
  | { t: "pickSite"; sites: JiraSite[] }
  | { t: "failed"; reason: string };

/** Whether an invite's table is still open; "unknown" when the server couldn't be asked. */
export type TableCheck = { t: "open" } | { t: "gone" } | { t: "unknown" };

export const OPEN_FAILED = "Couldn't open a table. Try again in a moment.";

export function createTables(deps: {
  fetch: FetchLike;
  storage: Pick<Storage, "hostPass" | "setHostPass" | "setDealerKey" | "jiraSite" | "setJiraSite">;
}) {
  const { storage } = deps;
  return {
    /** The host passcode that worked last time ("" if none). */
    savedPasscode: () => storage.hostPass(),
    /** Opens a new table that you deal, on Jira site `site` (default: the one you picked last). */
    async open(passcode: string, site?: string): Promise<OpenResult> {
      const body: OpenRequest = { site: site ?? (storage.jiraSite() || undefined) };
      const res = await deps
        .fetch("/api/rooms", {
          method: "POST",
          headers: { "x-host-passcode": passcode, "content-type": "application/json" },
          body: JSON.stringify(body),
        })
        .catch(() => null);
      if (!res) return { t: "failed", reason: OPEN_FAILED };
      const reply: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const refusal = OpenRefusal.safeParse(reply);
        if (!refusal.success) return { t: "failed", reason: OPEN_FAILED };
        if (refusal.data.signIn) return { t: "signIn" };
        if (refusal.data.sites) return { t: "pickSite", sites: refusal.data.sites };
        if (res.status === 401) return { t: "passcode", tried: passcode !== "" };
        return { t: "failed", reason: refusal.data.error };
      }
      const opened = OpenedTable.safeParse(reply);
      if (!opened.success) return { t: "failed", reason: OPEN_FAILED };
      storage.setHostPass(passcode);
      if (body.site) storage.setJiraSite(body.site);
      storage.setDealerKey(opened.data.code, opened.data.dealerKey);
      return { t: "opened", code: opened.data.code };
    },
    /** How opening a table works on this server, and who's signed in to Jira; null if it can't say. */
    async host(): Promise<HostInfo | null> {
      const res = await deps.fetch("/api/host").catch(() => null);
      const info = res?.ok ? HostInfo.safeParse(await res.json().catch(() => null)) : null;
      return info?.success ? info.data : null;
    },
    /** Signs this browser out of Jira. */
    async signOut(): Promise<boolean> {
      const res = await deps.fetch("/auth/jira/signout", { method: "POST" }).catch(() => null);
      return !!res?.ok;
    },
    /** Is table `code` still open? */
    async check(code: string): Promise<TableCheck> {
      const res = await deps.fetch(`/api/rooms/${encodeURIComponent(code)}`).catch(() => null);
      const info = res ? TableInfo.safeParse(await res.json().catch(() => null)) : null;
      if (!info?.success) return { t: "unknown" };
      return info.data.exists ? { t: "open" } : { t: "gone" };
    },
  };
}

export type Tables = ReturnType<typeof createTables>;
