// Deck presets, and the suit each card value wears. A deck is an ordered list
// of cards; "within one card" in the payout rule means one step along this order.
import type { Card } from "../protocol.ts";

export interface Deck {
  id: string;
  name: string;
  cards: Card[];
}

const numbers = (...points: number[]): Card[] => points.map((p) => ({ label: String(p), points: p }));

export const DECKS = {
  classic: { id: "classic", name: "1 2 3 5 8", cards: numbers(1, 2, 3, 5, 8) },
} satisfies Record<string, Deck>;

export type DeckId = keyof typeof DECKS;

/** Every value gets a suit, so the deck reads like a real (cheap) deck of cards. */
export const CARD_SUIT: Record<number, { glyph: string; red: boolean }> = {
  0: { glyph: "♠", red: false }, 1: { glyph: "♥", red: true }, 2: { glyph: "♣", red: false }, 3: { glyph: "♦", red: true },
  5: { glyph: "♠", red: false }, 8: { glyph: "♥", red: true }, 13: { glyph: "♣", red: false }, 21: { glyph: "♦", red: true },
};
