// Who may open a table (and so use the server's Jira token). Players never
// need this: the invite link is enough to sit down.
import type { IncomingMessage } from "node:http";

export interface DealerAuth {
  /** Whether opening a table asks for a passcode; the lobby uses this to prompt. */
  readonly needsPasscode: boolean;
  canOpenTable(req: IncomingMessage): boolean;
}

/** A shared passcode in the `x-host-passcode` header. Empty means anyone can open a table. */
export function passcodeAuth(passcode: string): DealerAuth {
  return {
    needsPasscode: !!passcode,
    canOpenTable: (req) => !passcode || req.headers["x-host-passcode"] === passcode,
  };
}
