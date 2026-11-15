import { test } from "node:test";
import assert from "node:assert/strict";
import { DeckChoice } from "../protocol.ts";
import { buildDeck, choiceOf, customCards, DEFAULT_DECK_CHOICE, deckWords, SCALE, SCALE_IDS, suitOf } from "./decks.ts";

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

test("a dealer's own numbers are dealt in order, once each, and are worth themselves", () => {
  assert.deepEqual(
    customCards(["8", " 2", "2", "16", "007", "1"]).map((c) => [c.label, c.points]),
    [
      ["1", 1],
      ["2", 2],
      ["7", 7],
      ["8", 8],
      ["16", 16],
    ],
  );
  const deck = buildDeck(choice({ scale: "custom", cards: ["10", "4", "6", "4"], unsure: true }));
  assert.equal(deckWords(deck!), "4 6 10 ?");
  assert.deepEqual(choiceOf(deck!), choice({ scale: "custom", cards: ["4", "6", "10"], unsure: true }));
  assert.equal(buildDeck(choice({ scale: "custom", cards: ["7", "7"] })), null, "one card isn't a vote");
  assert.equal(buildDeck(choice({ scale: "custom", cards: [] })), null);
  assert.equal(buildDeck(choice({ scale: "custom", cards: ["", "  "] })), null);
  // twelve numbers: the first ten are kept
  assert.equal(buildDeck(choice({ scale: "custom", cards: [...Array(12).keys()].map(String) }))?.length, 10);
  // numbers that happen to be a named scale are that scale
  assert.equal(choiceOf(buildDeck(choice({ scale: "custom", cards: ["1", "2", "3", "5", "8"] }))!).scale, "classic");
});

test("a dealer's own words are dealt as typed, and are worth their place: 1 for the first", () => {
  const sides = buildDeck(choice({ scale: "custom", cards: ["left", "right"] }));
  assert.deepEqual(sides, [
    { label: "left", points: 1 },
    { label: "right", points: 2 },
  ]);
  assert.deepEqual(choiceOf(sides), choice({ scale: "custom", cards: ["left", "right"] }), "and they read back");
  assert.deepEqual(
    customCards([" A ", "b", "a", "", "c"]).map((c) => [c.label, c.points]),
    [
      ["A", 1],
      ["b", 2],
      ["c", 3],
    ],
    "each card once, whatever its capitals",
  );
  // one word among the numbers and every card is worth its place, the numbers too
  assert.deepEqual(
    customCards(["8", "2", "lots"]).map((c) => [c.label, c.points]),
    [
      ["8", 1],
      ["2", 2],
      ["lots", 3],
    ],
  );
  assert.deepEqual(
    customCards(["a   very long thing to say", "🍕🍕"]).map((c) => c.label),
    ["a very lon", "🍕🍕"],
    "a card says as much as it has room for",
  );
  // sizes someone typed are their own cards, worth 1 to 5: not the T-shirts, which are worth 1 2 3 5 8
  assert.equal(choiceOf(customCards(["XS", "S", "M", "L", "XL"])).scale, "custom");
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
