import { useSyncExternalStore, type ReactNode } from "react";
import { useUi } from "../context.tsx";
import type { ToastTone } from "../toasts.ts";
import { cx } from "./cx.ts";
import s from "./Toast.module.css";

/** One toast. Usually you call `useUi().toasts.show(text)` and <Toaster> draws them. */
export function Toast({ tone = "info", children }: { tone?: ToastTone; children: ReactNode }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cx(s.toast, s[tone])}>
      <span className={s.dot} aria-hidden />
      {children}
    </div>
  );
}

/** The stack of current toasts, bottom left. mountUi adds one. */
export function Toaster() {
  const { toasts } = useUi();
  const items = useSyncExternalStore(toasts.subscribe, toasts.get);
  return (
    <div className={s.stack} aria-live="polite">
      {items.map((t) => (
        <Toast key={t.id} tone={t.tone}>
          {t.text}
        </Toast>
      ))}
    </div>
  );
}
