// Who may open a table, and with whose Jira. Players never need any of this: the invite link
// is enough to sit down. Two kinds: a shared host passcode (local dev, previews without Jira
// sign-in), or each dealer signing in with their own Jira account (jira-login.ts).
import type { IncomingMessage, ServerResponse } from "node:http";
import type { HostInfo, OpenRefusal, OpenRequest } from "../../shared/protocol.ts";
import type { TableJira } from "../table/state.ts";

export type OpenCheck =
  /** Open it; `jira` is whose Jira login the table uses (null: the server's own, if any). */
  { ok: true; jira: TableJira | null } | { ok: false; status: 401 | 403 | 409; refusal: OpenRefusal };

export interface DealerAuth {
  /** Whether opening a table asks for a passcode (the title screen asks for one on a 401). */
  readonly needsPasscode: boolean;
  /** May this request open a table, and with whose Jira? */
  open(req: IncomingMessage, body: OpenRequest): OpenCheck;
  /** How opening a table works here, for the title screen (GET /api/host). */
  host(req: IncomingMessage): HostInfo;
  /** Answers its own routes (signing in and out); false when `url` isn't one of them. */
  route(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean>;
}

/** A shared passcode in the `x-host-passcode` header. Empty means anyone can open a table. */
export function passcodeAuth(passcode: string): DealerAuth {
  return {
    needsPasscode: !!passcode,
    open: (req) =>
      !passcode || req.headers["x-host-passcode"] === passcode
        ? { ok: true, jira: null }
        : { ok: false, status: 401, refusal: { error: "Wrong host passcode" } },
    host: () => ({ jira: "off", user: null }),
    route: async () => false,
  };
}
