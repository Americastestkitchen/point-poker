// One builder per cosmetic in shared/catalog/cosmetics.ts. A new item is a
// catalog entry plus a file here; the rig puts it on the anchor its slot uses.
import type * as THREE from "three";
import type { CosmeticId, Slot } from "../../../../shared/catalog/cosmetics.ts";
import type { AnchorId } from "../bodies/anchors.ts";
import { beanie } from "./beanie.ts";
import { bowtie } from "./bowtie.ts";
import { chef } from "./chef.ts";
import { cone } from "./cone.ts";
import { crown } from "./crown.ts";
import { fez } from "./fez.ts";
import { horns } from "./horns.ts";
import { party } from "./party.ts";
import { tophat } from "./tophat.ts";
import { visor } from "./visor.ts";

export const BUILDERS: Record<CosmeticId, () => THREE.Object3D> = { beanie, tophat, cone, party, chef, horns, fez, crown };

/** Which anchor each slot hangs off. Items that fill several slots use their first one. */
export const SLOT_ANCHOR: Record<Slot, AnchorId> = { head: "head" };

/** What every dealer wears, whatever else they picked. */
export const DEALER_GEAR: readonly { anchor: AnchorId; build: () => THREE.Object3D }[] = [
  { anchor: "head", build: visor },
  { anchor: "chest", build: bowtie },
];
