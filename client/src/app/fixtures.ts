// Test helpers: small table views to diff and act on.
import { DECKS } from "../../../shared/catalog/decks.ts";
import type { PublicPlayer, TableView } from "../../../shared/protocol.ts";

export function player(id: string, extra: Partial<PublicPlayer> = {}): PublicPlayer {
  return {
    id,
    name: id.toUpperCase(),
    look: { color: "#3bceac", body: "bean", cosmetics: [] },
    seat: 0,
    isDealer: false,
    connected: true,
    plays: true,
    hasVoted: false,
    vote: null,
    revealedVote: null,
    chips: 0,
    lastWin: 0,
    ...extra,
  };
}

export function view(extra: Partial<TableView> = {}): TableView {
  return {
    code: "ABCD",
    phase: "waiting",
    round: 0,
    ticket: null,
    players: [
      player("deb", { isDealer: true, seat: -1, plays: false }),
      player("ann", { seat: 0 }),
      player("bob", { seat: 1 }),
    ],
    pot: 0,
    finalPoints: null,
    winners: [],
    share: 0,
    houseWon: false,
    history: [],
    skipped: [],
    jiraEnabled: false,
    settings: { deck: DECKS.classic.cards, dealerPlays: false, environment: "basement" },
    environment: "basement",
    epic: null,
    queue: [],
    queueLabel: "",
    ...extra,
  };
}

export const ticket = (key: string) => ({
  key,
  summary: `About ${key}`,
  description: "",
  type: "",
  status: "",
  priority: "",
  assignee: "",
  reporter: "",
  labels: [],
  currentPoints: null,
  url: "",
  adf: null,
  statusCategory: "" as const,
  parent: null,
});

/** The same view with some players changed. */
export const withPlayers = (v: TableView, f: (p: PublicPlayer) => Partial<PublicPlayer>): TableView => ({
  ...v,
  players: v.players.map((p) => ({ ...p, ...f(p) })),
});
