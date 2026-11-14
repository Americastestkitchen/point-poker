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
  /** It leaves a blob on the glass for a while. */
  splat: boolean;
}

/** How each item lands; null when there's nothing to show (someone's only pointing at you). */
export const HIT_LOOK: Record<ItemId, HitLook | null> = {
  point: null,
  hammer: { word: "BONK!", soft: false, shake: true, splat: false },
  coin: { word: "PLINK!", soft: false, shake: true, splat: false },
  plane: { word: "bop", soft: true, shake: false, splat: false },
  spitball: { word: "SPLAT!", soft: true, shake: false, splat: true },
};

/** A blob on the glass: where it lands (percent of the screen), how big, and which way it's turned. */
export interface Splat {
  x: number;
  y: number;
  size: number;
  turn: number;
}

/**
 * Where a spitball lands on your screen: anywhere across it, but only in the upper half, so it
 * never sits on your cards.
 */
export function splatAt(random: () => number): Splat {
  return { x: 12 + random() * 76, y: 10 + random() * 36, size: 70 + random() * 60, turn: random() * 360 };
}
