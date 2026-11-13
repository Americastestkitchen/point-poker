import { cx } from "../../ui/index.ts";
import { ticketKind } from "../text.ts";
import s from "./TypeIcon.module.css";

/** A Jira issue type's little square icon: a red dot for a bug, a lightning bolt for an epic. */
export function TypeIcon({ type, size = "md" }: { type: string; size?: "sm" | "md" }) {
  const { kind, glyph } = ticketKind(type);
  return (
    <span className={cx(s.icon, s[kind], s[size])} title={type || "Task"} role="img" aria-label={type || "Task"}>
      {glyph}
    </span>
  );
}
