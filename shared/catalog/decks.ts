// Deck presets. A deck is an ordered list of cards; "within one card" in the
// payout rule means one step along this order.
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
