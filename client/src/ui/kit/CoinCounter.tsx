import { useLayoutEffect, useRef } from "react";
import { countAt } from "../input/range.ts";
import { cx } from "./cx.ts";
import s from "./CoinCounter.module.css";

const ROLL_MS = 700;
const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

/**
 * Your coins. A new value rolls up (or down) to it and the coin bumps. The rolling number is
 * written straight to the DOM each frame: per-frame values never go into React state. React
 * renders the new value; a layout effect puts the old one back before paint and rolls from it.
 */
export function CoinCounter({
  value,
  size = "md",
  label = "coins",
}: {
  value: number;
  size?: "md" | "lg";
  label?: string;
}) {
  const root = useRef<HTMLSpanElement>(null);
  const text = useRef<HTMLSpanElement>(null);
  const shown = useRef(value);

  useLayoutEffect(() => {
    const from = shown.current;
    if (from === value || !text.current) return;
    const el = text.current;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const bump = root.current;
    const { bump: up, drop: down } = s;
    if (bump && up && down) {
      bump.classList.remove(up, down);
      void bump.offsetWidth; // restart the animation
      bump.classList.add(value > from ? up : down);
    }
    if (reduced) {
      shown.current = value;
      el.textContent = fmt(value);
      return;
    }
    el.textContent = fmt(from);
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const n = countAt(from, value, (now - start) / ROLL_MS);
      shown.current = n;
      el.textContent = fmt(n);
      if (n !== value) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return (
    <span ref={root} className={cx(s.counter, s[size])} role="status" aria-label={`${fmt(value)} ${label}`}>
      <span className={s.coin} aria-hidden />
      <span ref={text} className={s.amount} aria-hidden>
        {fmt(value)}
      </span>
    </span>
  );
}
