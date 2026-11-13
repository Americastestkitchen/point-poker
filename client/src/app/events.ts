// What happened. diff() works out what changed between two views; those
// changes arrive in the store with the view itself. Everything else that
// happens (effects, toasts, local moments) goes on the event stream.
import type { PublicPlayer, ServerMsg, TableView } from "../../../shared/protocol.ts";
import { allIn } from "../../../shared/rules.ts";

/** What changed between two views of the table, as worked out by diff(). */
export type ViewChange =
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
  | { t: "settled"; resettled: boolean };

/** Things that happen without changing the view. */
export type GameEvent =
  // ---- straight from the server: effects (someone looked around, talked,
  // emoted, flicked a chip or fiddled with their card) and toasts
  | Extract<ServerMsg, { t: "fx" | "toast" }>
  // ---- local
  /** You put a card down (`changed` when you swapped one already there). */
  | { t: "played"; value: number; changed: boolean }
  /** Something asked to show the ticket in full. */
  | { t: "openTicket" }
  /** A chip hit you in the face (the UI flashes "BONK!" and shakes the screen). */
  | { t: "bonked" };

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
export function diff(prev: TableView | null, next: TableView): ViewChange[] {
  if (!prev) return [{ t: "synced" }];
  const out: ViewChange[] = [];
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
