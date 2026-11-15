// What a playing card shows for a value: what's printed on it, its suit and a tiny, stable tilt,
// so the hand looks dealt rather than laid out by a robot. Pure; the card component
// (PlayingCard.tsx) draws it.
import { suitOf } from "../../../../shared/catalog/decks.ts";

export interface CardFace {
  value: number;
  /** What the card says: its number, a T-shirt size, "?". */
  label: string;
  glyph: string;
  red: boolean;
  /** Degrees, between -1.8 and 1.8; the same for the same value every time. */
  tilt: number;
}

export function cardFace(value: number, label = String(value)): CardFace {
  const suit = suitOf(value);
  return { value, label, glyph: suit.glyph, red: suit.red, tilt: (((Math.abs(value) * 37) % 7) - 3) * 0.6 };
}
