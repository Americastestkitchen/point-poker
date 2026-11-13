import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { useUi } from "../context.tsx";
import { useFocusable, type DemoState } from "../focus.ts";
import { cx } from "./cx.ts";
import s from "./Button.module.css";

interface Look {
  /**
   * `primary` is coin gold: the one thing to do next. `danger` is for leaving and kicking.
   * `link` is a quiet text action ("Vote again") next to a bigger one.
   */
  variant?: "default" | "primary" | "danger" | "ghost" | "link";
  size?: "sm" | "md" | "lg";
  /**
   * `pill` is a rounded chip for a bar of small controls; `round` is a circle that holds one
   * icon (give it an `aria-label`).
   */
  shape?: "rect" | "pill" | "round";
  /** A smaller second line under the label. */
  sub?: ReactNode;
  demoState?: DemoState;
}

export interface ButtonProps extends Look, Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "type"> {
  onPress?: () => void;
  /** Plays the confirm sound when pressed (default on). */
  sound?: boolean;
  /** For measuring or styling the button from outside (a meter, where coins fly to). */
  ref?: Ref<HTMLButtonElement>;
}

const classes = ({ variant = "default", size = "md", shape = "rect" }: Look, className?: string) =>
  cx(s.button, s[variant], s[size], shape !== "rect" && s[shape], className);

/**
 * Something to press. `aria-pressed` (a switch-like button such as mute) lights it up while on.
 */
export function Button({ variant, size, shape, sub, onPress, sound = true, demoState, className, children, disabled, ref, ...rest }: ButtonProps) {
  const { sounds } = useUi();
  const focus = useFocusable(disabled);
  return (
    <button
      type="button"
      {...rest}
      {...focus}
      ref={ref}
      disabled={disabled}
      data-demo={demoState}
      className={classes({ variant, size, shape }, className)}
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

export interface ButtonLinkProps extends Look, Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "target" | "rel"> {
  href: string;
}

/** A button-looking link that opens another site in a new tab ("Open in Jira ↗"). */
export function ButtonLink({ variant, size, shape, sub, demoState, className, children, ...rest }: ButtonLinkProps) {
  const focus = useFocusable();
  return (
    <a {...rest} {...focus} target="_blank" rel="noreferrer" data-demo={demoState} className={classes({ variant, size, shape }, className)}>
      <span className={s.label}>{children}</span>
      {sub && <small className={s.sub}>{sub}</small>}
    </a>
  );
}
