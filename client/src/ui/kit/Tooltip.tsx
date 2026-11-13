import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cx } from "./cx.ts";
import s from "./Tooltip.module.css";

export interface TooltipProps {
  text: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom";
  /** Gallery only: keep it showing. */
  open?: boolean;
}

const DELAY_MS = 350;

/** A label that shows when what it's on is hovered or focused (a tap focuses), after a short wait. */
export function Tooltip({ text, children, side = "top", open }: TooltipProps) {
  const id = useId();
  const [shown, setShown] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setShown(true), DELAY_MS);
  };
  const hide = () => {
    clearTimeout(timer.current);
    setShown(false);
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <span
      className={s.anchor}
      aria-describedby={id}
      onPointerEnter={(e) => e.pointerType === "mouse" && show()}
      onPointerLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      <span id={id} role="tooltip" className={cx(s.tip, s[side], (open ?? shown) && s.shown)}>
        {text}
      </span>
    </span>
  );
}
