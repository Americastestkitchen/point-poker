// A hand of playing cards: one Tab stop, arrow keys between the cards. The cards size
// themselves to the screen and the dock's height; past that the hand scrolls sideways.
import type { CSSProperties } from "react";
import { cx, ScrollArea, useRoving } from "../../ui/index.ts";
import type { HandCard } from "./dock.ts";
import { PlayingCard } from "./PlayingCard.tsx";
import s from "./Hand.module.css";

export interface HandProps {
  cards: readonly HandCard[];
  /** What the hand is, for screen readers: "Your cards", "Final points". */
  label: string;
  /** The dealer's settle hand: a bit smaller, with room for vote dots and ribbons. */
  settle?: boolean;
  onPress(card: HandCard): void;
}

export function Hand({ cards, label, settle = false, onPress }: HandProps) {
  const roving = useRoving(cards.length, { orientation: "horizontal", wrap: false });
  return (
    <ScrollArea className={cx(s.scroller, settle && s.settle)} style={{ "--cards": cards.length } as CSSProperties}>
      <div className={s.hand} role="group" aria-label={label}>
        {cards.map((c, i) => (
          <PlayingCard
            key={c.value}
            value={c.value}
            selected={c.selected}
            dimmed={c.dimmed}
            {...(c.suggested ? { ribbon: "most votes" } : {})}
            voters={c.voters}
            index={i}
            roving={roving.item(i)}
            onKeyDown={roving.onKeyDown}
            onPress={() => onPress(c)}
          />
        ))}
      </div>
    </ScrollArea>
  );
}
