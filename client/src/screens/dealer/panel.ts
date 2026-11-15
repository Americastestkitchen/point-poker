// What the dealer menu shows, decided from the table view. Pure, so it's tested without a
// browser; DealerMenu.tsx only draws it and wires the presses.
import type { Phase, PublicPlayer, TableView } from "../../../../shared/protocol.ts";
import { nextInQueue, voters } from "../../../../shared/rules.ts";

// ---------------------------------------------------------------- the tabs

export type DealerTab = "round" | "players" | "rules";

export const DEALER_TABS = [
  { id: "round", label: "Round" },
  { id: "players", label: "Players" },
  { id: "rules", label: "House rules" },
] as const satisfies readonly { id: DealerTab; label: string }[];

/** Where the menu opens: the house rules in the lobby, this round once the game is on. */
export const landingTab = (room: Pick<TableView, "started">): DealerTab => (room.started ? "round" : "rules");

// ---------------------------------------------------------------- the round tab

export type RoundActionId = "restart" | "skip" | "cancel" | "pick";

export interface RoundAction {
  id: RoundActionId;
  label: string;
  sub: string;
  enabled: boolean;
  danger: boolean;
}

type RoundView = Pick<TableView, "phase" | "queue" | "history" | "skipped" | "ticket">;

/** A round is live while the cards are being played or are up, before the points are final. */
export const isLive = (phase: Phase) => phase === "voting" || phase === "revealed";

/** Restart, skip and cancel (live rounds only), then pick a ticket (always). Cancel goes last, set apart. */
export function roundActions(room: RoundView): RoundAction[] {
  const live = isLive(room.phase);
  const next = nextInQueue(room);
  return [
    { id: "restart", label: "🔁 Restart vote", sub: "Everyone picks again", enabled: live, danger: false },
    {
      id: "skip",
      label: "⏭️ Skip ticket",
      sub: next ? `No payout · next up ${next.key}` : "No payout",
      enabled: live,
      danger: false,
    },
    {
      id: "pick",
      label: room.ticket ? "🗂️ Pick a different ticket" : "🗂️ Pick a ticket",
      sub: "Paste one, or choose from the line",
      enabled: true,
      danger: false,
    },
    { id: "cancel", label: "✋ Cancel round", sub: "No payout, and the ticket goes", enabled: live, danger: true },
  ];
}

/** The card at the top of the round tab: the ticket on the table and how the round is going. */
export function roundCard(room: Pick<TableView, "started" | "phase" | "ticket" | "players">): {
  key: string;
  title: string;
  line: string;
  empty: boolean;
} {
  const { ticket } = room;
  if (!ticket)
    return room.started
      ? { key: "", title: "No ticket on the table", line: "Pick one to start a round.", empty: true }
      : { key: "", title: "No ticket yet", line: "Start the game, then pick one.", empty: true };
  return { key: ticket.key, title: ticket.summary, line: roundLine(room), empty: false };
}

function roundLine(room: Pick<TableView, "phase" | "players">): string {
  switch (room.phase) {
    case "voting": {
      const playing = voters(room.players);
      const down = playing.filter((p) => p.hasVoted).length;
      return `${down} of ${playing.length} cards down`;
    }
    case "revealed":
      return "The cards are up";
    case "settled":
      return "Pointed";
    case "waiting":
      return "";
  }
}

// ---------------------------------------------------------------- the players tab

/** Skipping with a ticket lined up deals it, so it waits like any other ticket load. */
export function skipPlan(room: RoundView): { t: "load"; text: string } | { t: "do" } {
  const next = nextInQueue(room);
  return next ? { t: "load", text: `Skipping to ${next.key}…` } : { t: "do" };
}

/** What a player is up to, as the dealer sees it: away, or (while voting) voted or not. */
export function playerState(p: Pick<PublicPlayer, "connected" | "hasVoted">, phase: Phase): string {
  if (!p.connected) return "away";
  if (phase !== "voting") return "";
  return p.hasVoted ? "✓ voted" : "thinking…";
}

/** Everyone at the table except the dealer: who can be kicked. */
export const othersOf = <P extends Pick<PublicPlayer, "isDealer">>(players: readonly P[]): P[] =>
  players.filter((p) => !p.isDealer);

export const CANCEL_CONFIRM = {
  title: "Cancel this round?",
  body: "Nobody gets paid and the ticket is cleared.",
  confirm: "Cancel round",
} as const;

export const kickConfirm = (name: string) => ({
  title: `Kick ${name} from the table?`,
  body: "They won't be able to rejoin.",
  confirm: "Kick",
});
