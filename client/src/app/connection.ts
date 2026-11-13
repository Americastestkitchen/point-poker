// The connection's states and the rules for moving between them: when to
// dial, when to redial and when to give up. Pure, so the rules are tested
// without sockets; the session does what each step says.

export type Connection =
  | { status: "idle" }
  /** Dialling, or waiting to redial. `attempt` counts the tries since the line was last open. */
  | { status: "connecting"; room: string; attempt: number }
  | { status: "open"; room: string }
  /** For good: kicked, opened elsewhere, a full or missing table, or we left. */
  | { status: "closed"; room: string; reason: string };

export type ConnectionEvent =
  | { t: "join"; room: string }
  /** The socket opened. */
  | { t: "opened" }
  /** The socket closed, with its close code and reason. */
  | { t: "dropped"; code: number; reason: string }
  /** We hung up. */
  | { t: "leave" };

/** What the session should do after a step. */
export type ConnectionEffect =
  | { t: "dial" }
  | { t: "redial"; afterMs: number }
  /** Say who we are on the new line. */
  | { t: "hello" }
  | { t: "hangUp" };

/** 4001 kicked, 4002 opened elsewhere, 4003 table full, 4004 no such table: don't fight it. */
export const isFinal = (code: number) => code >= 4001 && code <= 4004;

/** The next state for `e`, and what to do about it (if anything). */
export function nextConnection(
  c: Connection,
  e: ConnectionEvent,
  retryDelay: (attempt: number) => number,
): [Connection, ConnectionEffect | null] {
  switch (e.t) {
    case "join":
      return [{ status: "connecting", room: e.room, attempt: 0 }, { t: "dial" }];
    case "opened":
      return c.status === "connecting" ? [{ status: "open", room: c.room }, { t: "hello" }] : [c, null];
    case "dropped": {
      if (c.status !== "connecting" && c.status !== "open") return [c, null];
      if (isFinal(e.code)) return [{ status: "closed", room: c.room, reason: e.reason }, null];
      const tries = c.status === "open" ? 0 : c.attempt;
      return [{ status: "connecting", room: c.room, attempt: tries + 1 }, { t: "redial", afterMs: retryDelay(tries) }];
    }
    case "leave":
      if (c.status !== "connecting" && c.status !== "open") return [c, null];
      return [{ status: "closed", room: c.room, reason: "" }, { t: "hangUp" }];
    default:
      return e satisfies never;
  }
}
