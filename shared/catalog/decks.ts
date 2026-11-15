// The cards a table can play with: the scales a dealer picks from, the extra cards, and the
// suit each value wears. A deck is an ordered list of cards; "within one card" in the payout
// rule means one step along this order.
import type { Card, DeckChoice } from "../protocol.ts";
import { byId, idsOf } from "./registry.ts";

export interface Scale {
  id: string;
  name: string;
  cards: readonly Card[];
}

const numbers = (...points: number[]): Card[] => points.map((p) => ({ label: String(p), points: p }));

export const SCALES = [
  { id: "classic", name: "The Usual", cards: numbers(1, 2, 3, 5, 8) },
  { id: "fibonacci", name: "Full Fibonacci", cards: numbers(0, 1, 2, 3, 5, 8, 13, 21) },
  {
    // sizes on the cards, the usual points behind them, so the pot and what goes to Jira stay numbers
    id: "tshirt",
    name: "T-shirts",
    cards: [
      { label: "XS", points: 1 },
      { label: "S", points: 2 },
      { label: "M", points: 3 },
      { label: "L", points: 5 },
      { label: "XL", points: 8 },
    ],
  },
] as const satisfies readonly Scale[];
export type ScaleId = (typeof SCALES)[number]["id"];
export const SCALE_IDS = idsOf(SCALES);
export const SCALE = byId(SCALES);
/** The scale a new table plays with. */
export const DEFAULT_SCALE: ScaleId = "classic";

/** A dealer's own scale: how many cards it can have, how many characters a card can say, and how big a number gets. */
export const CUSTOM_SCALE = {
  id: "custom",
  name: "Roll your own",
  min: 2,
  max: 10,
  longest: 10,
  highest: 999,
} as const;

/**
 * Extra cards a dealer can add to any scale. They say something instead of a number: they add
 * nothing to the pot and can't win it.
 */
export const EXTRA_CARDS = {
  unsure: { label: "?", name: "No idea" },
  coffee: { label: "☕", name: "Need a break" },
} as const;

/** The cards a dealer picks when they open a table without saying. */
export const DEFAULT_DECK_CHOICE: DeckChoice = { scale: DEFAULT_SCALE, cards: [], unsure: false, coffee: false };

const WHOLE = /^\d+$/;
const SEGMENTER = new Intl.Segmenter();
/** What a card says, a character at a time as a person counts them: an emoji is one. */
export const letters = (text: string): string[] => Array.from(SEGMENTER.segment(text), (s) => s.segment);

/**
 * A dealer's own cards as they'll be dealt, from what each one should say. When they're all
 * whole numbers those are the points, smallest first. Anything else ("left", "right") and the
 * cards say what was typed, in that order, and are worth their place in it: 1 for the first.
 * Each card once (whatever its capitals), and no more than a card has room for.
 */
export function customCards(raw: readonly string[]): Card[] {
  const seen = new Set<string>();
  const labels = raw
    .map((text) => letters(text.trim().replace(/\s+/g, " ")).slice(0, CUSTOM_SCALE.longest).join("").trim())
    .filter((label) => {
      const key = label.toLowerCase();
      if (!label || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  if (labels.every((label) => WHOLE.test(label) && Number(label) <= CUSTOM_SCALE.highest))
    return numbers(...[...new Set(labels.map(Number))].toSorted((a, b) => a - b).slice(0, CUSTOM_SCALE.max));
  return labels.slice(0, CUSTOM_SCALE.max).map((label, i) => ({ label, points: i + 1 }));
}

/** The deck a choice deals, or null when a custom scale has too few cards to vote with. */
export function buildDeck(choice: DeckChoice): Card[] | null {
  let cards: Card[];
  if (choice.scale === "custom") {
    cards = customCards(choice.cards);
    if (cards.length < CUSTOM_SCALE.min) return null;
  } else cards = SCALE[choice.scale].cards.map((c) => ({ ...c }));
  if (choice.unsure) cards.push({ label: EXTRA_CARDS.unsure.label, points: null });
  if (choice.coffee) cards.push({ label: EXTRA_CARDS.coffee.label, points: null });
  return cards;
}

/** The choice that deals `deck`: which scale it is (a scale nobody named is the dealer's own) and its extras. */
export function choiceOf(deck: readonly Card[]): DeckChoice {
  const scored = deck.filter((c) => c.points !== null);
  const says = (label: string) => deck.some((c) => c.points === null && c.label === label);
  const same = (cards: readonly Card[]) =>
    cards.length === scored.length &&
    cards.every((c, i) => {
      const dealt = scored[i];
      return dealt !== undefined && c.label === dealt.label && c.points === dealt.points;
    });
  const scale = SCALES.find((s) => same(s.cards));
  return {
    scale: scale?.id ?? "custom",
    cards: scale ? [] : scored.map((c) => c.label),
    unsure: says(EXTRA_CARDS.unsure.label),
    coffee: says(EXTRA_CARDS.coffee.label),
  };
}

/** A deck in a few words, for a notice or the status line: "1 2 3 5 8 ?". */
export const deckWords = (deck: readonly Card[]) => deck.map((c) => c.label).join(" ");

/** Every value gets a suit, so the deck reads like a real (cheap) deck of cards. */
const CARD_SUIT: Record<number, { glyph: string; red: boolean }> = {
  0: { glyph: "♠", red: false },
  1: { glyph: "♥", red: true },
  2: { glyph: "♣", red: false },
  3: { glyph: "♦", red: true },
  5: { glyph: "♠", red: false },
  8: { glyph: "♥", red: true },
  13: { glyph: "♣", red: false },
  21: { glyph: "♦", red: true },
};

/** The suit a played value wears: its own, spades for a number nobody planned for, a star for an extra card. */
export const suitOf = (value: number): { glyph: string; red: boolean } =>
  value < 0 ? { glyph: "★", red: false } : (CARD_SUIT[value] ?? { glyph: "♠", red: false });
