import type { ReactNode } from "react";
import s from "./KeyHint.module.css";

const GLYPH: Record<string, string> = {
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  Enter: "Enter",
  Escape: "Esc",
  " ": "Space",
  Space: "Space",
};

/** Keycaps with what they do, like "[Esc] Back". Hidden on touch-only screens. */
export function KeyHint({ keys, children }: { keys: readonly string[]; children?: ReactNode }) {
  return (
    <span className={s.hint}>
      {keys.map((k) => (
        <kbd key={k} className={s.key}>
          {GLYPH[k] ?? k.toUpperCase()}
        </kbd>
      ))}
      {children && <span className={s.label}>{children}</span>}
    </span>
  );
}
