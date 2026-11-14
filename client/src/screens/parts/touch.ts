// A tap shouldn't leave a HUD button focused: its tooltip would stay up over the room, a popup
// it opens would hand focus back to it, and the world's keys (emotes, the hotbar's numbers)
// would stop working until you tapped somewhere else.
import { useRef, type PointerEvent } from "react";

/**
 * Props for a kit Button that runs `action` when pressed and, after a touch (or pen) press,
 * lets go of focus; the mouse and the keyboard keep the kit's focus model. It lets go after the
 * press, not on pointerup: a tap focuses the button with the mouse events the browser makes up
 * after it.
 */
export function useLetGoAfterTouch(action: () => void) {
  const touched = useRef(false);
  return {
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      touched.current = e.pointerType !== "mouse";
    },
    onPress() {
      action();
      if (!touched.current) return;
      touched.current = false;
      const el = document.activeElement;
      if (el instanceof HTMLElement) el.blur();
    },
  };
}
