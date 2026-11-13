// What a player gets to see of a table. Other people's cards stay hidden
// until the reveal; your own is always yours to see.
import type { PublicPlayer, TableView } from "../../shared/protocol.ts";
import { isDealer, isVoter } from "./rules.ts";
import type { TableState } from "./state.ts";

export function viewFor(
  s: TableState,
  viewer: string | null,
  online: ReadonlySet<string>,
  jiraEnabled: boolean,
): TableView {
  const showVotes = s.phase === "revealed" || s.phase === "settled";
  const players: PublicPlayer[] = s.players.map((p) => ({
    id: p.id,
    name: p.name,
    look: p.look,
    seat: p.seat,
    isDealer: isDealer(s, p),
    connected: online.has(p.id),
    plays: isVoter(s, p),
    hasVoted: p.vote !== null,
    vote: showVotes || p.id === viewer ? p.vote : null,
    chips: p.chips,
    lastWin: p.lastWin,
  }));
  return {
    code: s.code,
    phase: s.phase,
    round: s.round,
    ticket: s.ticket,
    players,
    pot: showVotes ? s.pot : 0,
    finalPoints: s.finalPoints,
    winners: s.winners,
    share: s.share,
    houseWon: s.houseWon,
    history: s.history.slice(-100),
    skipped: [...s.skipped],
    jiraEnabled,
    settings: s.settings,
    epic: s.epic,
    queueLabel: s.queueLabel,
    queue: s.queue.map((q) => ({ ...q, played: s.history.some((h) => h.key === q.key) || s.skipped.includes(q.key) })),
  };
}
