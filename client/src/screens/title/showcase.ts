// A space on the screen for your bean: the element this ref lands on is measured, and the 3D
// world draws the bean into that box (store.showcase) for as long as it's on screen.
import { useLayoutEffect, useState } from "react";
import type { Look } from "../../../../shared/look.ts";
import { useGame } from "../game.tsx";

/** Returns a ref callback for the box to show `look` in. */
export function useShowcase(look: Look, dealer: boolean) {
  const { store } = useGame();
  const [box, setBox] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (!box) return;
    const measure = () => {
      const r = box.getBoundingClientRect();
      store.showcased({ look, dealer, rect: { x: r.left, y: r.top, width: r.width, height: r.height } });
    };
    measure();
    const resized = new ResizeObserver(measure);
    resized.observe(box);
    addEventListener("resize", measure);
    return () => {
      resized.disconnect();
      removeEventListener("resize", measure);
      store.showcased(null);
    };
  }, [box, look, dealer, store]);
  return setBox;
}
