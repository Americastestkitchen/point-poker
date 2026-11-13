// SLICE: round. Big moments over the room (region "announce", upper middle; never takes the
// pointer): "New ticket" on "dealt", "Cards up!" / consensus on "revealed" (with audio.flip()),
// and the payout on "settled" (house wins / you win +share / X takes the pot). Brief: they
// pass over the table, they don't stay on it. React with useViewChanges.
// Legacy parity: hud.ts announce(), celebrate() and the react() cases for dealt / revealed /
// settled. (The coin burst into the wallet is chrome's, in TopBar.)
// Props: none.
import s from "./Announcements.module.css";

export function Announcements() {
  return <div className={s.layer} aria-live="polite" />;
}
