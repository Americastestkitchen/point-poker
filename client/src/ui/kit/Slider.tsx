import { useRef } from "react";
import { useUi } from "../context.tsx";
import { useFocusable, type DemoState } from "../focus.ts";
import { intentOf } from "../input/intent.ts";
import { fraction, snap, valueAt } from "../input/range.ts";
import { cx } from "./cx.ts";
import s from "./Slider.module.css";

export interface SliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** How the value reads, e.g. `v => `${Math.round(v * 100)}%``. */
  format?: (value: number) => string;
  disabled?: boolean;
  demoState?: DemoState;
}

/** A value along a track: ←/→ step it, dragging or tapping the track sets it. */
export function Slider({ label, value, onChange, min = 0, max = 1, step = 0.1, format = String, disabled, demoState }: SliderProps) {
  const { sounds } = useUi();
  const focus = useFocusable(disabled);
  const track = useRef<HTMLSpanElement>(null);
  const range = { min, max, step };
  const set = (next: number) => {
    const v = snap(next, range);
    if (v === value) return;
    sounds.hover();
    onChange(v);
  };
  const fromPointer = (x: number) => {
    const r = track.current?.getBoundingClientRect();
    if (r) set(valueAt(x, r.left, r.width, range));
  };

  return (
    <div
      role="slider"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={format(value)}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      {...focus}
      data-demo={demoState}
      className={cx(s.slider, disabled && s.disabled)}
      onKeyDown={(e) => {
        const intent = intentOf(e);
        if (intent !== "left" && intent !== "right") return;
        e.preventDefault();
        set(value + (intent === "right" ? step : -step));
      }}
    >
      <span className={s.head}>
        <span className={s.label}>{label}</span>
        <span className={s.value}>{format(value)}</span>
      </span>
      <span
        ref={track}
        className={s.track}
        onPointerDown={(e) => {
          if (disabled) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          fromPointer(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) fromPointer(e.clientX);
        }}
      >
        <span className={s.fill} style={{ width: `${fraction(value, range) * 100}%` }}>
          <span className={s.thumb} />
        </span>
      </span>
    </div>
  );
}
