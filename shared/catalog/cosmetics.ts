// Things a bean can wear. Each one fills one or more slots, and a bean wears
// at most one thing per slot. A new item is a new entry here plus a builder
// in client/src/avatar/cosmetics/.
export type Slot = "head";

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
] as const satisfies readonly Cosmetic[];

export type CosmeticId = (typeof COSMETICS)[number]["id"];
export const COSMETIC_IDS = COSMETICS.map((c) => c.id) as [CosmeticId, ...CosmeticId[]];
export const cosmetic = (id: string): Cosmetic | undefined => COSMETICS.find((c) => c.id === id);
