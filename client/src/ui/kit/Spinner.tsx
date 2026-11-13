import { cx } from "./cx.ts";
import s from "./Spinner.module.css";

/** Something is on its way. With `label`, it says what (and screen readers hear it). */
export function Spinner({ label, size = "md" }: { label?: string; size?: "sm" | "md" | "lg" }) {
  return (
    <span className={cx(s.spinner, s[size])} role="status" aria-label={label ?? "Loading"}>
      <span className={s.ring} aria-hidden />
      {label && (
        <span className={s.label} aria-hidden>
          {label}
        </span>
      )}
    </span>
  );
}
