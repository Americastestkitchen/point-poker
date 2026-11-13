// What the dealer's control panel shows, decided from the table view. Pure, so it's tested
// without a browser; DealerPanel.tsx only draws it and wires the presses.
import type { Phase, PublicPlayer, TableView } from "../../../../shared/protocol.ts";
import { nextInQueue } from "../../../../shared/rules.ts";

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

/** "This round": restart, skip, cancel (live rounds only) and pick a ticket (always). */
export function roundActions(room: RoundView): RoundAction[] {
  const live = isLive(room.phase);
  const next = nextInQueue(room);
  return [
    { id: "restart", label: "🔁 Restart vote", sub: "everyone picks again", enabled: live, danger: false },
    {
      id: "skip",
      label: "⏭️ Skip ticket",
      sub: next ? `no payout · next ${next.key}` : "no payout",
      enabled: live,
      danger: false,
    },
    { id: "cancel", label: "✋ Cancel round", sub: "no payout, clear ticket", enabled: live, danger: true },
    { id: "pick", label: "🗂️ Pick a ticket", sub: "load or switch", enabled: true, danger: false },
  ];
}

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
