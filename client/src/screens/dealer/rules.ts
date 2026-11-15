// The house rules popup's decisions, from the table view and what the dealer typed. Pure, so
// it's tested without a browser; HouseRulesDialog.tsx only draws them and wires the presses.
import { CUSTOM_SCALE, customNumbers, SCALE, SCALE_IDS, type ScaleId } from "../../../../shared/catalog/decks.ts";
import type { Card, Phase } from "../../../../shared/protocol.ts";
import { cardValues } from "../../../../shared/rules.ts";

/** What the Cards carousel flips through: the named scales, then the dealer's own. */
export const SCALE_OPTIONS = [...SCALE_IDS, CUSTOM_SCALE.id] as const;
export type ScaleOption = (typeof SCALE_OPTIONS)[number];

const isNamed = (id: ScaleOption): id is ScaleId => id !== CUSTOM_SCALE.id;

export const scaleName = (id: ScaleOption) => (isNamed(id) ? SCALE[id].name : CUSTOM_SCALE.name);

/** What a scale's cards say, for the row of little cards under its name (`own` is what's typed for the dealer's own). */
export const scaleLabels = (id: ScaleOption, own: string): string[] =>
  isNamed(id) ? SCALE[id].cards.map((c) => c.label) : typedNumbers(own).map(String);

/** The numbers typed into "your numbers": whatever reads as a whole number, in order, each one once. */
export const typedNumbers = (text: string): number[] =>
  customNumbers(
    text
      .split(/[^0-9]+/)
      .filter(Boolean)
      .map(Number),
  );

/** What to start "your numbers" with: the numbers on the cards the table has now. */
export const numbersText = (deck: readonly Card[]) => cardValues(deck).join(", ");

export const TOO_FEW = `Give it at least ${CUSTOM_SCALE.min} different numbers.`;

/** Why the cards can't change right now, or null when they can: mid-round, someone's card would vanish. */
export const cardsLocked = (phase: Phase): string | null =>
  phase === "voting" || phase === "revealed" ? "The cards can change once this round is done." : null;
