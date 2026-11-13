// BUILDERS covers shared/catalog/cosmetics.ts; register each new item here.
// DEALER_GEAR adds fixed visor/bowtie builders outside the selectable catalog.
// The rig puts each item on the anchor its slot uses. Builders get the body's
// anchors, so face items can fit each shape's eyes; hats don't need them.
import type * as THREE from "three";
import type { CosmeticId, Slot } from "../../../../shared/catalog/cosmetics.ts";
import type { AnchorId, Anchors } from "../bodies/anchors.ts";
import { beanie } from "./beanie.ts";
import { beard } from "./beard.ts";
import { bowtie } from "./bowtie.ts";
import { chef } from "./chef.ts";
import { clown } from "./clown.ts";
import { cone } from "./cone.ts";
import { crown } from "./crown.ts";
import { disguise } from "./disguise.ts";
import { fez } from "./fez.ts";
import { glasses3d } from "./glasses3d.ts";
import { handlebar } from "./handlebar.ts";
import { horns } from "./horns.ts";
import { monocle } from "./monocle.ts";
import { party } from "./party.ts";
import { schnoz } from "./schnoz.ts";
import { shades } from "./shades.ts";
import { specs } from "./specs.ts";
import { tophat } from "./tophat.ts";
import { visor } from "./visor.ts";
import { walrus } from "./walrus.ts";

export const BUILDERS: Record<CosmeticId, (fit: Anchors) => THREE.Object3D> = {
  beanie,
  tophat,
  cone,
  party,
  chef,
  horns,
  fez,
  crown,
  specs,
  shades,
  monocle,
  glasses3d,
  clown,
  schnoz,
  disguise,
  handlebar,
  walrus,
  beard,
};

/** Which anchor each slot hangs off. Items that fill several slots use their first one. */
export const SLOT_ANCHOR: Record<Slot, AnchorId> = { head: "head", eyes: "eyes", nose: "nose", facialHair: "mouth" };

/** What every dealer wears, whatever else they picked. */
export const DEALER_GEAR: readonly { anchor: AnchorId; build: () => THREE.Object3D }[] = [
  { anchor: "head", build: visor },
  { anchor: "chest", build: bowtie },
];
