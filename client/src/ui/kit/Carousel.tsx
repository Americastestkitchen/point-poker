import type { ReactNode } from "react";
import { useUi } from "../context.tsx";
import { useFocusable, type DemoState } from "../focus.ts";
import { direction, intentOf } from "../input/intent.ts";
import { step } from "../input/roving.ts";
import { cx } from "./cx.ts";
import s from "./Carousel.module.css";

export interface CarouselProps<T> {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  /** How an option looks; its string form by default. */
  render?: (option: T) => ReactNode;
  /** Shows "3 / 7"-style dots under the value (default on). */
  dots?: boolean;
  disabled?: boolean;
  demoState?: DemoState;
}

/** Pick one of a few options with ←/→, the arrow buttons, or a tap on either side. */
export function Carousel<T>({ label, options, value, onChange, render = String, dots = true, disabled, demoState }: CarouselProps<T>) {
  const { sounds } = useUi();
  const focus = useFocusable(disabled);
  const index = Math.max(0, options.indexOf(value));
  const go = (dir: -1 | 1) => {
    if (disabled || options.length < 2) return;
    sounds.hover();
    onChange(options[step(index, options.length, dir)]!);
  };

  return (
    <div
      role="group"
      aria-label={label}
      aria-roledescription="carousel"
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      {...focus}
      data-demo={demoState}
      className={cx(s.carousel, disabled && s.disabled)}
      onKeyDown={(e) => {
        const dir = direction(intentOf(e), "horizontal");
        if (dir) { e.preventDefault(); go(dir); }
      }}
    >
      <span className={s.label}>{label}</span>
      <div className={s.row}>
        <button type="button" tabIndex={-1} className={s.arrow} aria-label={`Previous ${label}`} disabled={disabled} onClick={() => go(-1)}>◀</button>
        <div className={s.value} aria-live="polite">
          <span key={index} className={s.option}>{render(options[index] as T)}</span>
        </div>
        <button type="button" tabIndex={-1} className={s.arrow} aria-label={`Next ${label}`} disabled={disabled} onClick={() => go(1)}>▶</button>
      </div>
      {dots && options.length > 1 && (
        <div className={s.dots} aria-hidden>
          {options.map((_, i) => <span key={i} className={cx(s.dot, i === index && s.on)} />)}
        </div>
      )}
    </div>
  );
}
