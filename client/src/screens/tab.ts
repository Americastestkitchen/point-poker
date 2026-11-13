// The browser tab, for a dealer who is in another window on a call: its title, and when the
// "everyone's in" chime plays. Pure; GameRoot.tsx applies them.
import type { TableView } from "../../../shared/protocol.ts";
import { allIn } from "../../../shared/rules.ts";
import type { ViewChange } from "../app/events.ts";

const isDealer = (room: TableView, meId: string | undefined) => room.players.some((p) => p.id === meId && p.isDealer);

/** Every voter has a card down and it's the dealer's move. */
const waitingOnDealer = (room: TableView, meId: string | undefined) =>
  room.phase === "voting" && allIn(room.players) && isDealer(room, meId);

/** "SD-12 · Point Poker"; for the dealer, "✅ All in · Point Poker" until the round moves on. */
export function tabTitle(room: TableView | null, meId: string | undefined): string {
  if (room && waitingOnDealer(room, meId)) return "✅ All in · Point Poker";
  const key = room?.ticket?.key;
  return `${key ? `${key} · ` : ""}Point Poker`;
}

/**
 * Which round the chime is for, or null for no chime: the dealer hears it once per round,
 * when the last voter's card goes down (a card taken back and put down again doesn't ring twice).
 * `chimed` is the round it last rang for.
 */
export function chimeFor(
  change: ViewChange,
  room: TableView,
  meId: string | undefined,
  chimed: string | null,
): string | null {
  if (change.t !== "allIn" || !waitingOnDealer(room, meId)) return null;
  const round = `${room.code}:${room.round}`;
  return round === chimed ? null : round;
}
