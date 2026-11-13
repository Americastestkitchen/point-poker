// One focus for keys, mouse and touch: hovering with the mouse moves focus too, so the
// highlighted thing is always the one Enter would pick.
import { useCallback, useRef, useState, type FocusEvent, type KeyboardEvent, type PointerEvent } from "react";
import { useUi } from "./context.tsx";
import { direction, intentOf, type Orientation } from "./input/intent.ts";
import { first, step } from "./input/roving.ts";

/** Forces how a control looks, for the dev gallery only. */
export type DemoState = "hover" | "focus" | "pressed";

/** Props that make an element share the one focus and tick when it gets it. */
export function useFocusable(disabled = false) {
  const { sounds } = useUi();
  return {
    onPointerEnter: (e: PointerEvent<HTMLElement>) => {
      if (e.pointerType === "mouse" && !disabled && document.activeElement !== e.currentTarget) {
        e.currentTarget.focus({ preventScroll: true });
      }
    },
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
      items.current[next]?.focus({ preventScroll: true });
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
