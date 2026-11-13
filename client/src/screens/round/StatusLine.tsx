// SLICE: round. The status line (region "status", top centre; never takes the pointer): the
// Pick / Reveal / Settle steps, one line of what's happening, and while voting a PlayerDot per
// voter (filled once they've picked).
// Legacy parity: hud.ts renderStatus().
// Props: none.
import s from "./StatusLine.module.css";

export function StatusLine() {
  return <div className={s.placeholder}>StatusLine · round</div>;
}
