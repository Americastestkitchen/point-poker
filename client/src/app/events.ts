// One stream of things that just happened, for the HUD, the scene and audio.
// It merges what diff() works out from two views with the server's effects.
import type { EmoteId } from "../../../shared/catalog/emotes.ts";
import type { PublicPlayer, TableView } from "../../../shared/protocol.ts";
import { allIn } from "../../../shared/rules.ts";

export type GameEvent =
  // ---- worked out by diff()
  /** The first view of this table arrived. */
  | { t: "synced" }
  | { t: "joined"; player: PublicPlayer }
  | { t: "left"; player: PublicPlayer }
  /** Someone switched body shape. */
  | { t: "reshaped"; player: PublicPlayer }
  /** A new round of voting started (a new ticket, or the dealer restarted the vote). */
  | { t: "dealt" }
  /** A different ticket is on the table, or the same one was dealt again. */
  | { t: "ticketChanged" }
  /** Every voter has a card down. */
  | { t: "allIn" }
  | { t: "revealed" }
  /** The dealer called the final points; `resettled` when they changed their call. */
  | { t: "settled"; resettled: boolean }
  // ---- effects from the server
  | { t: "gaze"; id: string; yaw: number; pitch: number }
  | { t: "talk"; id: string; level: number }
  | { t: "emote"; id: string; emote: EmoteId }
  | { t: "flick"; from: string; to: string }
  /** Someone swapped their face-down card. */
  | { t: "adjust"; id: string }
  | { t: "toast"; text: string; level?: "info" | "error" }
  // ---- local
  /** You put a card down (`changed` when you swapped one already there). */
  | { t: "played"; value: number; changed: boolean }
  /** Something asked to show the ticket in full. */
  | { t: "openTicket" };

export interface Events {
  on(listener: (e: GameEvent) => void): () => void;
  emit(e: GameEvent): void;
}

export function createEvents(): Events {
  const listeners = new Set<(e: GameEvent) => void>();
  return {
    on(l) { listeners.add(l); return () => listeners.delete(l); },
    emit(e) { for (const l of [...listeners]) l(e); },
  };
}

const everyoneIn = (s: TableView) => s.phase === "voting" && allIn(s.players);

/** What changed between two views of the table, as events. Pure. */
export function diff(prev: TableView | null, next: TableView): GameEvent[] {
  if (!prev) return [{ t: "synced" }];
  const out: GameEvent[] = [];
  const before = new Map(prev.players.map((p) => [p.id, p]));
  const after = new Set(next.players.map((p) => p.id));
  for (const p of next.players) {
    const was = before.get(p.id);
    if (!was) out.push({ t: "joined", player: p });
    else if (was.look.body !== p.look.body) out.push({ t: "reshaped", player: p });
  }
  for (const p of prev.players) if (!after.has(p.id)) out.push({ t: "left", player: p });

  const newRound = prev.phase !== next.phase || prev.round !== next.round;
  if (newRound && next.phase === "voting") out.push({ t: "dealt" });
  if (next.ticket && (prev.ticket?.key !== next.ticket.key || (newRound && next.phase === "voting"))) out.push({ t: "ticketChanged" });
  if (everyoneIn(next) && (newRound || !everyoneIn(prev))) out.push({ t: "allIn" });
  if (newRound && next.phase === "revealed") out.push({ t: "revealed" });
  if (next.phase === "settled" && (newRound || prev.finalPoints !== next.finalPoints)) out.push({ t: "settled", resettled: !newRound });
  return out;
}
