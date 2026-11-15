import { test } from "node:test";
import assert from "node:assert/strict";
import { DeckChoice } from "../protocol.ts";
import {
  buildDeck,
  choiceOf,
  customNumbers,
  DEFAULT_DECK_CHOICE,
  deckWords,
  SCALE,
  SCALE_IDS,
  suitOf,
} from "./decks.ts";

const choice = (c: Partial<DeckChoice>): DeckChoice => ({ ...DEFAULT_DECK_CHOICE, ...c });

test("every scale deals its cards, with the extras at the end, and reads back as the same choice", () => {
  for (const scale of SCALE_IDS) {
    for (const unsure of [false, true]) {
      for (const coffee of [false, true]) {
        const picked = choice({ scale, unsure, coffee });
        const deck = buildDeck(picked);
        assert.ok(deck, scale);
        assert.equal(deck.length, SCALE[scale].cards.length + Number(unsure) + Number(coffee));
        assert.deepEqual(choiceOf(deck), picked);
      }
    }
  }
  assert.equal(deckWords(buildDeck(choice({ unsure: true, coffee: true }))!), "1 2 3 5 8 ? ☕");
  assert.equal(deckWords(buildDeck(choice({ scale: "tshirt" }))!), "XS S M L XL");
  assert.deepEqual(
    buildDeck(choice({ scale: "tshirt" }))!.map((c) => c.points),
    [1, 2, 3, 5, 8],
    "sizes are worth the usual points",
  );
});

test("a dealer's own numbers are dealt whole, in order, once each", () => {
  assert.deepEqual(customNumbers([8, 2, 2, 4.5, -1, 16, 4000, 1]), [1, 2, 8, 16]);
  const deck = buildDeck(choice({ scale: "custom", numbers: [10, 4, 6, 4], unsure: true }));
  assert.equal(deckWords(deck!), "4 6 10 ?");
  assert.deepEqual(choiceOf(deck!), choice({ scale: "custom", numbers: [4, 6, 10], unsure: true }));
  assert.equal(buildDeck(choice({ scale: "custom", numbers: [7, 7] })), null, "one number isn't a vote");
  assert.equal(buildDeck(choice({ scale: "custom", numbers: [] })), null);
  // twelve numbers: the first ten are kept
  assert.equal(buildDeck(choice({ scale: "custom", numbers: [...Array(12).keys()] }))?.length, 10);
  // numbers that happen to be a named scale are that scale
  assert.equal(choiceOf(buildDeck(choice({ scale: "custom", numbers: [1, 2, 3, 5, 8] }))!).scale, "classic");
});

test("a choice from an old browser reads with the defaults filled in", () => {
  assert.deepEqual(DeckChoice.parse({ scale: "fibonacci" }), choice({ scale: "fibonacci" }));
  assert.equal(DeckChoice.safeParse({ scale: "tarot" }).success, false);
});

test("every played value wears a suit", () => {
  assert.deepEqual(suitOf(3), { glyph: "♦", red: true });
  assert.deepEqual(suitOf(40), { glyph: "♠", red: false }, "a number nobody planned for");
  assert.deepEqual(suitOf(-6), { glyph: "★", red: false }, "an extra card");
});
