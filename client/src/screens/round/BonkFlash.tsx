// "BONK!" across the whole screen when a chip hits you (region "flash"; never takes the
// pointer), and the whole page, canvas included, shakes for a moment. A second hit restarts
// both. The shake sits out under prefers-reduced-motion (the CSS decides).
// Legacy parity: hud.ts react() "bonked" (#bonk-flash and the body's shake class).
import { useEffect, useRef, useState } from "react";
import { useGameEvents } from "../moments.ts";
import s from "./BonkFlash.module.css";

/** How long the screen shakes (the CSS animation is the same length). */
const SHAKE_MS = 360;
/** The body's class while it shakes (a CSS module name, so it can't clash). */
const SHAKE = s.shake ?? "pp-bonk-shake";

export function BonkFlash() {
  // which hit is showing (a new one restarts the animation), or null when it's done
  const [hit, setHit] = useState<number | null>(null);
  const hits = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useGameEvents((e) => {
    if (e.t !== "bonked") return;
    setHit(++hits.current);
    // on the body, so the canvas under the UI shakes too; off and on again restarts it
    const body = document.body;
    body.classList.remove(SHAKE);
    void body.offsetWidth;
    body.classList.add(SHAKE);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => body.classList.remove(SHAKE), SHAKE_MS);
  });

  useEffect(() => () => {
    clearTimeout(timer.current);
    document.body.classList.remove(SHAKE);
  }, []);

  return (
    <div className={s.layer} aria-hidden>
      {hit !== null && (
        <div key={hit} className={s.flash} onAnimationEnd={(e) => { if (e.target === e.currentTarget) setHit(null); }}>
          <span className={s.word}>BONK!</span>
        </div>
      )}
    </div>
  );
}
