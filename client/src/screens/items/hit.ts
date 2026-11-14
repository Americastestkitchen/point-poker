// What it looks like on your own screen when someone's hand item lands on you. Pure, so it's
// tested here; HitFlash.tsx draws it.
import type { ItemId } from "../../../../shared/catalog/items.ts";

export interface HitLook {
  /** The word that flashes across the screen. */
  word: string;
  /** A soft one flashes small, without the red glow. */
  soft: boolean;
  /** The whole page shakes. */
  shake: boolean;
}

/** How each item lands; null when there's nothing to show (someone's only pointing at you). */
export const HIT_LOOK: Record<ItemId, HitLook | null> = {
  point: null,
  hammer: { word: "BONK!", soft: false, shake: true },
  chip: { word: "PLINK!", soft: false, shake: true },
  plane: { word: "bop", soft: true, shake: false },
};
