// The house rules popup's decisions, from the table view and what the dealer typed. Pure, so
// it's tested without a browser; HouseRulesDialog.tsx only draws them and wires the presses.
import { CUSTOM_SCALE, customCards, SCALE, SCALE_IDS, type ScaleId } from "../../../../shared/catalog/decks.ts";
import type { Card, Phase } from "../../../../shared/protocol.ts";

/** What the Cards carousel flips through: the named scales, then the dealer's own. */
export const SCALE_OPTIONS = [...SCALE_IDS, CUSTOM_SCALE.id] as const;
export type ScaleOption = (typeof SCALE_OPTIONS)[number];

const isNamed = (id: ScaleOption): id is ScaleId => id !== CUSTOM_SCALE.id;

export const scaleName = (id: ScaleOption) => (isNamed(id) ? SCALE[id].name : CUSTOM_SCALE.name);

/** What a scale's cards say, for the row of little cards under its name (`own` is what's typed for the dealer's own). */
export const scaleLabels = (id: ScaleOption, own: string): string[] =>
  isNamed(id) ? SCALE[id].cards.map((c) => c.label) : customCards(typedCards(own)).map((c) => c.label);

/**
 * What's typed into "your cards", one piece per card: split at commas (or semicolons, or new
 * lines), so a card can say two words. With none of those, at the spaces: "left right" is two cards.
 */
export const typedCards = (text: string): string[] => text.split(/[,;\n]/.test(text) ? /[,;\n]+/ : /\s+/);

/** What to start "your cards" with: what the cards the table has now say, without the extras. */
export const ownText = (deck: readonly Card[]) =>
  deck
    .filter((c) => c.points !== null)
    .map((c) => c.label)
    .join(", ");

export const TOO_FEW = `Give it at least ${CUSTOM_SCALE.min} different cards.`;
/** How a dealer's own cards score, under the box they're typed in. */
export const OWN_HINT = "Numbers are worth themselves. Words are worth 1, 2, 3… left to right.";

/** Why the cards can't change right now, or null when they can: mid-round, someone's card would vanish. */
export const cardsLocked = (phase: Phase): string | null =>
  phase === "voting" || phase === "revealed" ? "The cards can change once this round is done." : null;
