// Things a bean can wear. Each one fills one or more slots, and a bean wears
// at most one thing per slot. A new item is a new entry here plus a builder
// in client/src/avatar/cosmetics/.
import { byId, idsOf } from "./registry.ts";

/** Where on the bean an item goes: a hat on top, then the face's eyewear, nose and facial hair. */
export type Slot = "head" | "eyes" | "nose" | "facialHair";

export interface Cosmetic {
  id: string;
  label: string;
  icon: string;
  slots: readonly Slot[];
}

export const COSMETICS = [
  { id: "beanie", label: "propeller", icon: "🧢", slots: ["head"] },
  { id: "tophat", label: "top hat", icon: "🎩", slots: ["head"] },
  { id: "cone", label: "cone", icon: "🚧", slots: ["head"] },
  { id: "party", label: "party", icon: "🥳", slots: ["head"] },
  { id: "chef", label: "chef", icon: "🧑‍🍳", slots: ["head"] },
  { id: "horns", label: "viking", icon: "🪖", slots: ["head"] },
  { id: "fez", label: "fez", icon: "🔴", slots: ["head"] },
  { id: "crown", label: "crown", icon: "👑", slots: ["head"] },
  { id: "specs", label: "nerd specs", icon: "🤓", slots: ["eyes"] },
  { id: "shades", label: "shades", icon: "😎", slots: ["eyes"] },
  { id: "monocle", label: "monocle", icon: "🧐", slots: ["eyes"] },
  { id: "glasses3d", label: "3D glasses", icon: "🎬", slots: ["eyes"] },
  { id: "clown", label: "clown nose", icon: "🤡", slots: ["nose"] },
  { id: "schnoz", label: "big schnoz", icon: "👃", slots: ["nose"] },
  /** The Groucho disguise: glasses, eyebrows and a nose in one, so it fills both slots. */
  { id: "disguise", label: "disguise", icon: "🥸", slots: ["eyes", "nose"] },
  { id: "handlebar", label: "handlebar", icon: "👨", slots: ["facialHair"] },
  { id: "walrus", label: "walrus", icon: "🦭", slots: ["facialHair"] },
  { id: "beard", label: "big beard", icon: "🧔", slots: ["facialHair"] },
] as const satisfies readonly Cosmetic[];

export type CosmeticId = (typeof COSMETICS)[number]["id"];
export const COSMETIC_IDS = idsOf(COSMETICS);
export const COSMETIC = byId(COSMETICS);

/** Whether an item takes up a slot. */
export function fills(item: Cosmetic, slot: Slot): boolean {
  const slots: readonly Slot[] = item.slots;
  return slots.includes(slot);
}

/** Everything that fits a slot, in catalog order. */
export const fitting = (slot: Slot) => COSMETICS.filter((c) => fills(c, slot));

/** The face slots, in the order the wardrobe shows them. */
export const FACE_SLOTS = ["eyes", "nose", "facialHair"] as const satisfies readonly Slot[];
