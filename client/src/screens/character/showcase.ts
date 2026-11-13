// A space on the screen for your bean: the element this ref lands on is measured, and the 3D
// world draws the bean into that box (store.showcase) for as long as it's on screen.
//
// The box is measured when it mounts, when it resizes and when the window resizes. A box that
// moves for any other reason (an animation, a scrolling parent) isn't followed, so keep these
// boxes still: absolutely placed, with no transforms or transitions that move them.
import { useLayoutEffect, useRef, useState } from "react";
import type { Look } from "../../../../shared/look.ts";
import type { ScreenRect, Showcase } from "../../app/store.ts";
import { useGame } from "../game.tsx";

const sameRect = (a: ScreenRect | null, b: ScreenRect) =>
  !!a && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

/** Returns a ref callback for the box to show `look` in. */
export function useShowcase(look: Look, dealer: boolean) {
  const { store } = useGame();
  const [box, setBox] = useState<HTMLElement | null>(null);
  const [rect, setRect] = useState<ScreenRect | null>(null);
  const shown = useRef<Showcase | null>(null);

  // where the box is: only when it mounts or something resizes
  useLayoutEffect(() => {
    if (!box) return;
    const measure = () => {
      const r = box.getBoundingClientRect();
      const next = { x: r.left, y: r.top, width: r.width, height: r.height };
      setRect((prev) => (sameRect(prev, next) ? prev : next));
    };
    measure();
    const resized = new ResizeObserver(measure);
    resized.observe(box);
    addEventListener("resize", measure);
    return () => {
      resized.disconnect();
      removeEventListener("resize", measure);
    };
  }, [box]);

  // what the world shows there: one store write per change of look or place
  useLayoutEffect(() => {
    if (!rect) return;
    shown.current = { look, dealer, rect };
    store.showcased(shown.current);
  }, [rect, look, dealer, store]);

  // gone from the screen: the bean goes too, unless another screen shows it by now
  useLayoutEffect(
    () => () => {
      if (shown.current) store.showcaseEnded(shown.current);
    },
    [store],
  );

  return setBox;
}
