// The toasts the screen root shows by itself for what happened. Pure, so they're tested here.
import type { Connection } from "../app/connection.ts";
import type { GameEvent, ViewChange } from "../app/events.ts";
import type { ToastTone } from "../ui/index.ts";

export interface Notice {
  text: string;
  tone: ToastTone;
  /** Plays the bonk with it. */
  bonk: boolean;
}

/** A toast for a change in the view: someone else sat down, or someone left. */
export function viewNotice(c: ViewChange, meId: string | undefined): Notice | null {
  if (c.t === "joined" && c.player.id !== meId)
    return { text: `👋 ${c.player.name} sat down`, tone: "info", bonk: false };
  if (c.t === "left") return { text: `🚪 ${c.player.name} left`, tone: "info", bonk: false };
  return null;
}

/** A toast from the event stream (the server's, or a failed action's): errors bonk. */
export function eventNotice(e: GameEvent): Notice | null {
  if (e.t !== "toast") return null;
  return { text: e.text, tone: e.level ?? "info", bonk: e.level === "error" };
}

/** The server's close reason when the dealer kicks you (server/table/commands.ts). */
const REMOVED = "Removed by the dealer";

/** A toast when the line to the table closes because the dealer removed you. */
export function connectionNotice(prev: Connection, next: Connection): Notice | null {
  if (next === prev || next.status !== "closed" || next.reason !== REMOVED) return null;
  return { text: "👋 The dealer removed you from this table.", tone: "error", bonk: false };
}
