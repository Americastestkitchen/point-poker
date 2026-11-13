// A titled block inside the dealer's popups ("This round", "Players (3)").
import { useId, type ReactNode } from "react";
import { cx } from "../../ui/index.ts";
import s from "./Section.module.css";

export function Section({ title, aside, className, children }: { title: ReactNode; aside?: ReactNode; className?: string; children: ReactNode }) {
  const id = useId();
  return (
    <section className={cx(s.section, className)} aria-labelledby={id}>
      <header className={s.head}>
        <h3 id={id} className={s.title}>{title}</h3>
        {aside && <span className={s.aside}>{aside}</span>}
      </header>
      {children}
    </section>
  );
}
