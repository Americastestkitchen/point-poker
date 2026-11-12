// What players get to see of a table. Votes stay hidden until the reveal.
import type { PublicPlayer, RoomState } from "../../shared/protocol.ts";
import { isDealer, isVoter } from "./rules.ts";
import type { TableState } from "./state.ts";

export function publicView(s: TableState, online: ReadonlySet<string>, jiraEnabled: boolean): RoomState {
  const showVotes = s.phase === "revealed" || s.phase === "settled";
  const players: PublicPlayer[] = s.players.map((p) => ({
    id: p.id, name: p.name, color: p.color, hat: p.hat, body: p.body, seat: p.seat, isDealer: isDealer(s, p),
    connected: online.has(p.id), plays: isVoter(s, p), hasVoted: p.vote !== null,
    vote: showVotes ? p.vote : null, chips: p.chips, lastWin: p.lastWin,
  }));
  return {
    code: s.code, phase: s.phase, round: s.round, ticket: s.ticket, players,
    pot: showVotes ? s.pot : 0, finalPoints: s.finalPoints, winners: s.winners,
    share: s.share, houseWon: s.houseWon, history: s.history.slice(-100), skipped: [...s.skipped], jiraEnabled,
    dealerPlays: s.settings.dealerPlays, epic: s.epic, queueLabel: s.queueLabel,
    queue: s.queue.map((q) => ({ ...q, played: s.history.some((h) => h.key === q.key) || s.skipped.includes(q.key) })),
  };
}
