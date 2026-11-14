// What you see when someone's hand item lands on you (region "flash"; never takes the pointer):
// a word across the whole screen ("BONK!"), the whole page, canvas included, shaking for a
// moment, and a spitball's blob on the glass. hit.ts says which item does what. A second hit
// restarts the flash and the shake; blobs pile up and slide off on their own. The shake sits
// out under prefers-reduced-motion (the CSS decides).
import { useEffect, useRef, useState } from "react";
import { cx } from "../../ui/index.ts";
import { useGameEvents } from "../moments.ts";
import { HIT_LOOK, splatAt, type HitLook, type Splat } from "./hit.ts";
import s from "./HitFlash.module.css";

/** How long the screen shakes (the CSS animation is the same length). */
const SHAKE_MS = 360;
/** The body's class while it shakes (a CSS module name, so it can't clash). */
const SHAKE = s.shake ?? "pp-hit-shake";

export function HitFlash() {
  // transient animation state: which hit is showing (a new one restarts the animation), and
  // the blobs still on the glass
  const [hit, setHit] = useState<{ id: number; look: HitLook } | null>(null);
  const [splats, setSplats] = useState<(Splat & { id: number })[]>([]);
  const hits = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useGameEvents((e) => {
    if (e.t !== "hit") return;
    const look = HIT_LOOK[e.item];
    if (!look) return;
    const id = ++hits.current;
    setHit({ id, look });
    if (look.splat) setSplats((now) => [...now, { id, ...splatAt(Math.random) }]);
    if (!look.shake) return;
    // on the body, so the canvas under the UI shakes too; off and on again restarts it
    const body = document.body;
    body.classList.remove(SHAKE);
    void body.offsetWidth;
    body.classList.add(SHAKE);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => body.classList.remove(SHAKE), SHAKE_MS);
  });

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      document.body.classList.remove(SHAKE);
    },
    [],
  );

  return (
    <div className={s.layer} aria-hidden>
      {splats.map((p) => (
        <span
          key={p.id}
          className={s.splat}
          style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size, "--turn": `${p.turn}deg` }}
          onAnimationEnd={() => setSplats((now) => now.filter((x) => x.id !== p.id))}
        />
      ))}
      {hit !== null && (
        <div
          key={hit.id}
          className={cx(s.flash, hit.look.soft && s.soft)}
          onAnimationEnd={(e) => {
            if (e.target === e.currentTarget) setHit(null);
          }}
        >
          <span className={s.word}>{hit.look.word}</span>
        </div>
      )}
    </div>
  );
}
