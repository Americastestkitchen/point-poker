// What a playing card shows for a value: its suit and a tiny, stable tilt, so the hand looks
// dealt rather than laid out by a robot. Pure; the card component (PlayingCard.tsx) draws it.
import { CARD_SUIT } from "../../../../shared/catalog/decks.ts";

export interface CardFace {
  value: number;
  glyph: string;
  red: boolean;
  /** Degrees, between -1.8 and 1.8; the same for the same value every time. */
  tilt: number;
}

export function cardFace(value: number): CardFace {
  const suit = CARD_SUIT[value] ?? { glyph: "♠", red: false };
  return { value, glyph: suit.glyph, red: suit.red, tilt: (((value * 37) % 7) - 3) * 0.6 };
}
