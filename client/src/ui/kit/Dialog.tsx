import { createContext, useContext, useId, useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useBack, useUi } from "../context.tsx";
import { cx } from "./cx.ts";
import { Panel } from "./Panel.tsx";
import { ScrollArea } from "./ScrollArea.tsx";
import s from "./Dialog.module.css";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  /** Buttons along the bottom. */
  actions?: ReactNode;
  /** Esc, the × and a click outside close it (default on). Off for "you must choose". */
  dismissable?: boolean;
  width?: "sm" | "md" | "lg" | "xl";
  /** `paper` for a page you read (a ticket), not a game panel. */
  variant?: "default" | "paper";
}

// what Tab stops on: the ✕ isn't one (Esc does its job), and neither is anything else at -1
const FOCUSABLE = [
  ":is(button, input, select, textarea):not(:disabled):not([tabindex='-1'])",
  ":is(a[href], [contenteditable='true'], [contenteditable='']):not([tabindex='-1'])",
  "[tabindex='0']",
].join(", ");

/** How many dialogs this one is inside: one opened from inside another sits on top of it. */
const Depth = createContext(0);

/**
 * A popup over the game. It takes focus when it opens, keeps Tab inside, closes on Esc
 * (only the topmost one, if they stack) and hands focus back to where it was.
 */
export function Dialog({ open, onClose, title, children, actions, dismissable = true, width = "md", variant = "default" }: DialogProps) {
  const { sounds, layer } = useUi();
  const box = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const close = () => {
    sounds.back();
    onClose();
  };
  const depth = useContext(Depth) + 1;
  // one you must answer still takes Esc, and does nothing with it: Esc never reaches what's underneath
  useBack(dismissable ? close : () => {}, open, depth);

  // a layout effect: it notes where focus was before any field inside autofocuses (those use plain effects)
  useLayoutEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    // `data-autofocus` first, wherever it is; a field with autoFocus takes over after this
    const firstStop = box.current?.querySelector<HTMLElement>("[data-autofocus]") ?? box.current?.querySelector<HTMLElement>(FOCUSABLE);
    (firstStop ?? box.current)?.focus({ preventScroll: true });
    return () => before?.focus?.({ preventScroll: true });
  }, [open]);

  if (!open) return null;

  // Tab and Shift+Tab go round the dialog instead of escaping to the page behind
  const trapTab = (e: KeyboardEvent) => {
    // a dialog opened from inside this one handled it already (React events bubble through portals)
    if (e.key !== "Tab" || e.defaultPrevented || !box.current) return;
    const stops = [...box.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (stops.length === 0) return;
    const i = stops.indexOf(document.activeElement as HTMLElement);
    const next = e.shiftKey ? (i <= 0 ? stops.length - 1 : i - 1) : (i === stops.length - 1 ? 0 : i + 1);
    e.preventDefault();
    stops[next]!.focus();
  };

  return createPortal(
    <div className={s.backdrop} style={{ zIndex: `calc(var(--pp-layer-dialog) + ${depth})` }} onPointerDown={(e) => { if (dismissable && e.target === e.currentTarget) close(); }}>
      <div ref={box} role="dialog" aria-modal aria-labelledby={titleId} tabIndex={-1} className={cx(s.box, s[width])} onKeyDown={trapTab}>
        <Panel padding="lg" variant={variant} className={cx(s.panel, s[variant])}>
          <header className={s.head}>
            <h2 id={titleId} className={s.title}>{title}</h2>
            {dismissable && <button type="button" tabIndex={-1} className={s.x} aria-label="Close" onClick={close}>✕</button>}
          </header>
          {/* only the body scrolls: the title and the buttons stay put on a short phone */}
          <ScrollArea className={s.body}><Depth value={depth}>{children}</Depth></ScrollArea>
          {actions && <footer className={s.actions}>{actions}</footer>}
        </Panel>
      </div>
    </div>,
    layer ?? document.body,
  );
}
