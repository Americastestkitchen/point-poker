// One focus for keys, mouse and touch: hovering with the mouse moves focus too, so the
// highlighted thing is always the one Enter would pick.
import { useCallback, useRef, useState, type FocusEvent, type KeyboardEvent, type PointerEvent } from "react";
import { useUi } from "./context.tsx";
import { direction, intentOf, type Orientation } from "./input/intent.ts";
import { first, step } from "./input/roving.ts";

/** Forces how a control looks, for the dev gallery only. */
export type DemoState = "hover" | "focus" | "pressed";

/** Marks an element whose focus came from the mouse resting on it, not from a key or a press. */
const HOVER_FOCUS = "data-hover-focus";

/** Was `el` focused only because the mouse was over it? A popup doesn't hand focus back to one. */
export const hoverFocused = (el: Element | null) => el?.hasAttribute(HOVER_FOCUS) ?? false;

/** Is `el` somewhere you type (a text field)? */
const typing = (el: Element | null) => !!el?.matches("input, textarea, select, [contenteditable]:not([contenteditable='false'])");

/** Props that make an element share the one focus and tick when it gets it. */
export function useFocusable(disabled = false) {
  const { sounds } = useUi();
  return {
    // Only a mouse that really moved: a control that appears under a resting cursor (a menu
    // opening with Esc) must not take focus from the item the keyboard is on.
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      if (e.pointerType !== "mouse" || disabled || (e.movementX === 0 && e.movementY === 0)) return;
      // never from a field you're typing in: Enter there must not press whatever the mouse is over
      const held = document.activeElement;
      if (held === e.currentTarget || (typing(held) && !hoverFocused(held))) return;
      e.currentTarget.setAttribute(HOVER_FOCUS, "");
      e.currentTarget.focus({ preventScroll: true });
    },
    // The mouse moved on: focus it only borrowed goes back to the page, so it doesn't linger on
    // a control nobody chose. Inside a dialog it stays (the arrow keys keep working there) and
    // stays borrowed, so the next thing the mouse reaches can have it.
    onPointerLeave: (e: PointerEvent<HTMLElement>) => {
      const el = e.currentTarget;
      if (e.pointerType !== "mouse" || !hoverFocused(el) || el.closest("[role='dialog']")) return;
      el.removeAttribute(HOVER_FOCUS);
      if (document.activeElement === el) el.blur();
    },
    // clicking into a field or typing in it makes it yours: it keeps focus when the mouse leaves
    onPointerDownCapture: (e: PointerEvent<HTMLElement>) => { if (typing(e.currentTarget)) e.currentTarget.removeAttribute(HOVER_FOCUS); },
    onKeyDownCapture: (e: KeyboardEvent<HTMLElement>) => { if (typing(e.currentTarget)) e.currentTarget.removeAttribute(HOVER_FOCUS); },
    onBlur: (e: FocusEvent<HTMLElement>) => e.currentTarget.removeAttribute(HOVER_FOCUS),
    onFocus: (_e: FocusEvent<HTMLElement>) => {
      if (!disabled) sounds.hover();
    },
  };
}

interface RovingOptions {
  orientation?: Orientation;
  wrap?: boolean;
  disabled?: (index: number) => boolean;
}

/**
 * Arrow keys move focus between a list's items. Only one item is a Tab stop, so Tab leaves
 * the list instead of walking through it.
 */
export function useRoving(count: number, { orientation = "vertical", wrap = true, disabled = () => false }: RovingOptions = {}) {
  const items = useRef<(HTMLElement | null)[]>([]);
  const [active, setActive] = useState(-1);
  const tabStop = active >= 0 && active < count && !disabled(active) ? active : first(count, disabled);

  const onKeyDown = useCallback((e: KeyboardEvent<HTMLElement>) => {
    const dir = direction(intentOf(e), orientation);
    if (!dir) return;
    const current = items.current.findIndex((el) => el === document.activeElement);
    const next = step(current, count, dir, { wrap, disabled });
    if (next >= 0) {
      e.preventDefault();
      const item = items.current[next];
      item?.focus({ preventScroll: true });
      // only as far as needed, so a list inside a scroll area follows the arrow keys
      item?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }, [count, orientation, wrap, disabled]);

  return {
    onKeyDown,
    item: (index: number) => ({
      ref: (el: HTMLElement | null) => void (items.current[index] = el),
      tabIndex: index === tabStop ? 0 : -1,
      onFocusCapture: () => setActive(index),
    }),
  };
}
