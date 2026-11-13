// The status line's words: where the round is (Pick → Reveal → Settle), one line of what's
// happening, and while voting who has picked. Pure; StatusLine.tsx draws it.
import type { PublicPlayer, TableView } from "../../../../shared/protocol.ts";
import { voters } from "../../../../shared/rules.ts";
import { pointsWord } from "../text.ts";

export type StepState = "done" | "current" | "idle";

export interface Status {
  steps: { label: "Pick" | "Reveal" | "Settle"; state: StepState }[];
  /** No round going (waiting for a ticket): the steps fade back. */
  idle: boolean;
  line: string;
  /** While voting, every voter and whether they've picked; null otherwise. */
  voters: { player: PublicPlayer; voted: boolean; label: string }[] | null;
}

const STEPS = ["Pick", "Reveal", "Settle"] as const;
const STEP_OF = { waiting: 0, voting: 1, revealed: 2, settled: 3 } as const;

export function statusModel(room: TableView, meId: string | undefined, myVote: number | null): Status {
  const playing = voters(room.players);
  const dealer = !!room.players.find((p) => p.id === meId)?.isDealer;
  const amVoter = playing.some((p) => p.id === meId);
  const step = STEP_OF[room.phase];
  const steps = STEPS.map((label, i) => ({
    label,
    state: (i + 1 < step ? "done" : i + 1 === step ? "current" : "idle") as StepState,
  }));

  let line: string;
  switch (room.phase) {
    case "waiting":
      line = dealer ? "Add a ticket to start" : "Waiting for the dealer to add a ticket…";
      break;
    case "voting":
      line =
        amVoter && myVote === null
          ? "Pick a card below"
          : `${playing.filter((p) => p.hasVoted).length} of ${playing.length} picked`;
      break;
    case "revealed":
      line = dealer ? "Choose the final points below" : "The dealer is choosing the final points…";
      break;
    case "settled":
      line = `Final: ${room.finalPoints} ${pointsWord(room.finalPoints)}`;
      break;
  }

  return {
    steps,
    idle: step === 0,
    line,
    voters:
      room.phase === "voting"
        ? playing.map((p) => ({
            player: p,
            voted: p.hasVoted,
            label: `${p.name}${p.hasVoted ? " ✓" : " is thinking…"}`,
          }))
        : null,
  };
}
