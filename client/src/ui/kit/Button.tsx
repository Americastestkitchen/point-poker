import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useUi } from "../context.tsx";
import { useFocusable, type DemoState } from "../focus.ts";
import { cx } from "./cx.ts";
import s from "./Button.module.css";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "type"> {
  /** `primary` is coin gold: the one thing to do next. `danger` is for leaving and kicking. */
  variant?: "default" | "primary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  /** A smaller second line under the label. */
  sub?: ReactNode;
  onPress?: () => void;
  /** Plays the confirm sound when pressed (default on). */
  sound?: boolean;
  demoState?: DemoState;
}

export function Button({ variant = "default", size = "md", sub, onPress, sound = true, demoState, className, children, disabled, ...rest }: ButtonProps) {
  const { sounds } = useUi();
  const focus = useFocusable(disabled);
  return (
    <button
      type="button"
      {...rest}
      {...focus}
      disabled={disabled}
      data-demo={demoState}
      className={cx(s.button, s[variant], s[size], className)}
      onClick={() => {
        if (sound) sounds.confirm();
        onPress?.();
      }}
    >
      <span className={s.label}>{children}</span>
      {sub && <small className={s.sub}>{sub}</small>}
    </button>
  );
}
