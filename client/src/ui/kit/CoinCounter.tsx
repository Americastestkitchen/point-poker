import { useEffect, useRef } from "react";
import { countAt } from "../input/range.ts";
import { cx } from "./cx.ts";
import s from "./CoinCounter.module.css";

const ROLL_MS = 700;
const fmt = (n: number) => n.toLocaleString("en-US");

/**
 * Your coins. A new value rolls up (or down) to it and the coin bumps. The rolling number is
 * written straight to the DOM each frame: per-frame values never go into React state.
 */
export function CoinCounter({ value, size = "md", label = "coins" }: { value: number; size?: "md" | "lg"; label?: string }) {
  const root = useRef<HTMLSpanElement>(null);
  const text = useRef<HTMLSpanElement>(null);
  const shown = useRef(value);

  useEffect(() => {
    const from = shown.current;
    if (from === value || !text.current) return;
    const el = text.current;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const bump = root.current;
    bump?.classList.remove(s.bump!, s.drop!);
    void bump?.offsetWidth; // restart the animation
    bump?.classList.add(value > from ? s.bump! : s.drop!);
    if (reduced) {
      shown.current = value;
      el.textContent = fmt(value);
      return;
    }
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
      <span ref={text} className={s.amount} aria-hidden>{fmt(shown.current)}</span>
    </span>
  );
}
