import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./cx.ts";
import s from "./Panel.module.css";

export interface PanelProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title?: ReactNode;
  /** `paper` is the playing-card cream; `neon` is the rare pink accent (title screen, logo). */
  variant?: "default" | "paper" | "neon";
  padding?: "none" | "sm" | "md" | "lg";
}

export function Panel({ title, variant = "default", padding = "md", className, children, ...rest }: PanelProps) {
  return (
    <section {...rest} className={cx(s.panel, s[variant], s[`pad-${padding}`], className)}>
      {title && <h2 className={s.title}>{title}</h2>}
      {children}
    </section>
  );
}
