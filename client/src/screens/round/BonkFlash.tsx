// SLICE: round. "BONK!" across the whole screen when a chip hits you (region "flash", full
// screen, never takes the pointer): listen with useGameEvents for "bonked" and replay the flash.
// Legacy parity: hud.ts react() "bonked" and index.html #bonk-flash (plus a short shake).
// Props: none.
import s from "./BonkFlash.module.css";

export function BonkFlash() {
  return <div className={s.flash} aria-hidden />;
}
