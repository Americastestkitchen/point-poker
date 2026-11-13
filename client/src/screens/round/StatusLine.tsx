// The status line (region "status", top centre; never takes the pointer): the Pick → Reveal →
// Settle steps, one line of what's happening, and while voting a dot per voter (filled once
// they've picked). status.ts decides the words.
// Legacy parity: hud.ts renderStatus().
import { cx } from "../../ui/index.ts";
import { useAppState, useRoom } from "../game.tsx";
import { PlayerDot } from "../parts/PlayerDot.tsx";
import { statusModel } from "./status.ts";
import s from "./StatusLine.module.css";

export function StatusLine() {
  const room = useRoom();
  const meId = useAppState((st) => st.me?.id);
  const myVote = useAppState((st) => st.ui.myVote);
  if (!room) return null;
  const status = statusModel(room, meId, myVote);
  return (
    <div className={s.status}>
      <ol className={cx(s.steps, status.idle && s.idle)} aria-label="Round">
        {status.steps.map((step, i) => (
          <li key={step.label} className={cx(s.step, s[step.state])} aria-current={step.state === "current" ? "step" : undefined}>
            <b className={s.mark} aria-hidden>{step.state === "done" ? "✓" : i + 1}</b>
            {step.label}
          </li>
        ))}
      </ol>
      <p className={s.line}>
        <span className={s.text}>{status.line}</span>
        {status.voters && status.voters.length > 0 && (
          <span className={s.dots}>
            {status.voters.map((v) => <PlayerDot key={v.player.id} player={v.player} filled={v.voted} title={v.label} />)}
          </span>
        )}
      </p>
    </div>
  );
}
