// The chrome's decisions, kept pure so node tests cover them: what the top bar says, who the
// leaderboard lists and how, what "Copy for Jira" copies, and when coins fly to your wallet.
import type { PublicPlayer, RoundResult, TableView } from "../../../../shared/protocol.ts";
import type { Connection } from "../../app/connection.ts";
import type { ViewChange } from "../../app/events.ts";
import type { Popup } from "../../app/store.ts";
import type { MicStatus } from "../../audio/mic.ts";
import { names } from "../text.ts";

// ------------------------------------------------------------------ top bar

/** The line next to the buttons while the table's line is down; null while it's fine. */
export function connectionLabel(c: Connection): string | null {
  if (c.status === "connecting") return "reconnecting…";
  if (c.status === "closed") return c.reason ? `disconnected: ${c.reason}` : "disconnected";
  return null;
}

/** The mic button's tooltip, as before #11. */
export function micTip(status: MicStatus): string {
  return status === "on"
    ? "Mic on: your mouth moves when you talk (no audio is sent). Click to turn off."
    : "Turn on mic: your character's mouth moves when you talk (no audio is sent)";
}

/** The mic button looks pressed while it's listening (and while the browser is asking). */
export const micPressed = (status: MicStatus) => status === "on" || status === "starting";

// ------------------------------------------------------------------ wallet

/**
 * Did this new view pay you? Then your coins fly in and the wallet counts up when they land;
 * otherwise it shows your chips straight away. Your share is the round's `share` (the house's
 * whole pot when the house won and you're the dealer: you're its winner then).
 */
export function walletWin(
  changes: readonly ViewChange[],
  room: Pick<TableView, "winners" | "share">,
  meId: string | undefined,
): number | null {
  if (!meId || !changes.some((c) => c.t === "settled") || !room.winners.includes(meId)) return null;
  return room.share;
}

/** How long after the settle the coins burst out, so the announcement lands first. */
export const BURST_DELAY_MS = 350;

/** More coins for a bigger win, but always a handful and never a flood. */
export const burstSize = (amount: number) => Math.max(8, Math.min(28, Math.round(amount)));

export interface Point {
  x: number;
  y: number;
}

/**
 * One coin's flight: out of `from` to a random spot around it (`angle`, `radius`), a little
 * hover, then into `to`. `i` staggers the coins so they stream in one after another.
 */
export function coinFlight(i: number, from: Point, to: Point, angle: number, radius: number) {
  const bx = from.x + Math.cos(angle) * radius,
    by = from.y + Math.sin(angle) * radius * 0.7;
  return {
    keyframes: [
      { transform: `translate(${from.x}px, ${from.y}px) scale(.3)`, opacity: 0 },
      { transform: `translate(${bx}px, ${by}px) scale(1.15)`, opacity: 1, offset: 0.35 },
      { transform: `translate(${bx}px, ${by - 10}px) scale(1)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${to.x}px, ${to.y}px) scale(.55)`, opacity: 0.9 },
    ],
    timing: { duration: 1150 + i * 35, delay: i * 18, easing: "cubic-bezier(.3,.1,.3,1)", fill: "both" as const },
  };
}

/** Every third coin that lands clinks (all of them at once would be noise). */
export const clinks = (landed: number) => landed % 3 === 0;

// ------------------------------------------------------------------ leaderboard

export interface BoardRow {
  player: PublicPlayer;
  /** "👑" for a leader who has chips, otherwise their place. */
  rank: string;
  /** "Ann · dealer · away". */
  name: string;
  me: boolean;
  away: boolean;
  /** The dealer can remove someone who's away (not themselves: the dealer isn't removable). */
  removable: boolean;
}

/** Players by chips, most first (ties keep their seat order). */
export function boardRows(players: readonly PublicPlayer[], meId: string | undefined, iAmDealer: boolean): BoardRow[] {
  return players
    .toSorted((a, b) => b.chips - a.chips)
    .map((p, i) => ({
      player: p,
      rank: i === 0 && p.chips > 0 ? "👑" : String(i + 1),
      name: `${p.name}${p.isDealer ? " · dealer" : ""}${p.connected ? "" : " · away"}`,
      me: p.id === meId,
      away: !p.connected,
      removable: iAmDealer && !p.isDealer && !p.connected,
    }));
}

/** How a round turned out: "house wins · Ann +12", "Ann & Bob +3", "no cards played". */
export function roundOutcome(h: Pick<RoundResult, "houseWon" | "winners" | "share">): string {
  if (h.houseWon) return `house wins · ${names(h.winners)} +${h.share}`;
  return h.winners.length ? `${names(h.winners)} +${h.share}` : "no cards played";
}

/** Who got talked round after the reveal: "Ann 3 → 5 · Bob 2 → 3", or null when nobody switched. */
export function roundSwitches(h: Pick<RoundResult, "switched">): string | null {
  if (!h.switched?.length) return null;
  return h.switched.map((w) => `${w.name} ${w.from} → ${w.to}`).join(" · ");
}

/** Rounds played, newest first. */
export const roundsNewestFirst = (history: readonly RoundResult[]) => history.toReversed();

/**
 * For pasting into Jira: the latest result per ticket, oldest first, one "KEY\tN pts\tSummary"
 * line each. Re-pointing a ticket keeps its first place but takes its latest points.
 */
export function jiraExport(history: readonly RoundResult[]): { text: string; count: number; done: string } {
  const latest = new Map<string, RoundResult>();
  for (const h of history) latest.set(h.key, h);
  const text = [...latest.values()].map((h) => `${h.key}\t${h.finalPoints} pts\t${h.summary}`).join("\n");
  const count = latest.size;
  return { text, count, done: `📋 Copied ${count} ticket${count === 1 ? "" : "s"} and their points` };
}

// ------------------------------------------------------------------ popups

/**
 * Where closing a popup goes: back to the game menu when that's where it was opened from
 * (Options, How to play), otherwise nowhere. Popups are one at a time, so "back" reopens it.
 */
export const backTo = (openedFrom: Popup | null): Popup | null => (openedFrom === "menu" ? "menu" : null);
