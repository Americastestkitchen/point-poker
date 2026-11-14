// A popup that remembers which popup it was opened from, so closing it can go back there
// (Options and How to play go back to the game menu). Popups are one at a time in the store,
// so "back" reopens the menu rather than uncovering it.
import { useEffect, useState } from "react";
import type { Popup } from "../../app/store.ts";
import { useGame, usePopup } from "../game.tsx";

export function usePopupWithBack(popup: Popup) {
  const { store } = useGame();
  const own = usePopup(popup);
  // which popup this one replaced when it opened: a temporary note, not a copy of the store
  const [from, setFrom] = useState<Popup | null>(null);
  useEffect(
    () =>
      store.subscribe((s, prev) => {
        if (s.ui.popup === popup && prev.ui.popup !== popup) setFrom(prev.ui.popup);
      }),
    [store, popup],
  );

  // back to the game menu when that's where this was opened from (Options, How to play),
  // otherwise nowhere
  const back: Popup | null = from === "menu" ? "menu" : null;
  return {
    open: own.open,
    /** Where closing goes: "menu" when it came from there, otherwise null (just closes). */
    back,
    close() {
      if (back) store.popupOpened(back);
      else own.close();
    },
  };
}
