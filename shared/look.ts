// How a bean looks: one object, checked the same way everywhere.
import { z } from "zod";
import { BODY_IDS } from "./catalog/bodies.ts";
import { COLORS } from "./catalog/colors.ts";
import { COSMETIC_IDS, COSMETICS, cosmetic, type CosmeticId, type Slot } from "./catalog/cosmetics.ts";

export const Look = z.object({
  color: z.enum(COLORS),
  body: z.enum(BODY_IDS),
  /** What the bean is wearing; at most one thing per slot. */
  cosmetics: z.array(z.enum(COSMETIC_IDS)),
});
export type Look = z.infer<typeof Look>;

/** What a browser may send: anything look-shaped. validateLook() makes it a Look. */
export const LookInput = z.object({
  color: z.string().max(32),
  body: z.string().max(32),
  cosmetics: z.array(z.string().max(32)).max(16),
}).partial();
export type LookInput = z.infer<typeof LookInput>;

export const DEFAULT_LOOK: Look = { color: COLORS[0], body: "bean", cosmetics: [] };

// What validateLook() checks each part with: the Look schema's own fields.
const color = Look.shape.color.catch(DEFAULT_LOOK.color);
const body = Look.shape.body.catch(DEFAULT_LOOK.body);
const item = Look.shape.cosmetics.element;

/** Keeps what's valid and falls back to the defaults for the rest. Unknown items and clashing slots are dropped. */
export function validateLook(input: LookInput | undefined): Look {
  const cosmetics: CosmeticId[] = [];
  const taken = new Set<Slot>();
  for (const raw of input?.cosmetics ?? []) {
    const id = item.safeParse(raw);
    if (!id.success) continue;
    const { slots } = cosmetic(id.data)!;
    if (slots.some((s) => taken.has(s))) continue;
    slots.forEach((s) => taken.add(s));
    cosmetics.push(id.data);
  }
  return { color: color.parse(input?.color), body: body.parse(input?.body), cosmetics };
}

/** The item in a slot, if any. */
export const wornIn = (look: Look, slot: Slot): CosmeticId | null =>
  look.cosmetics.find((id) => cosmetic(id)?.slots.includes(slot)) ?? null;

/** Puts `id` on (or clears the slot when null), taking off whatever was in its slots. */
export function wear(look: Look, slot: Slot, id: CosmeticId | null): Look {
  const slots = id ? cosmetic(id)!.slots : [slot];
  const kept = look.cosmetics.filter((c) => !cosmetic(c)!.slots.some((s) => slots.includes(s)));
  return { ...look, cosmetics: id ? [...kept, id] : kept };
}

/** A random look for someone new: any colour and body, and a hat. */
export function randomLook(random: () => number = Math.random): Look {
  const pick = <T,>(a: readonly T[]) => a[Math.floor(random() * a.length)];
  return { color: pick(COLORS), body: pick(BODY_IDS), cosmetics: [pick(COSMETICS.filter((c) => c.slots.includes("head"))).id] };
}
