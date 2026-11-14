// Hand items: silly things to use on someone at the table. Each has a hotbar key, the emoji
// the hotbar shows, and how long you wait before using it again (the server enforces that).
// Using one changes nothing at the table: everyone just sees it happen.
import { byId, idsOf } from "./registry.ts";

export interface Item {
  id: string;
  /** The key that picks it, and its place on the hotbar. */
  key: string;
  emoji: string;
  name: string;
  /** What using it on someone does, for the hotbar's tip. */
  does: string;
  cooldownMs: number;
}

export const ITEMS = [
  { id: "point", key: "1", emoji: "👉", name: "Empty hand", does: "Point at someone", cooldownMs: 1000 },
  { id: "hammer", key: "2", emoji: "🔨", name: "Squeaky hammer", does: "Bonk someone", cooldownMs: 2500 },
  { id: "coin", key: "3", emoji: "🪙", name: "Coin", does: "Flick it at someone", cooldownMs: 600 },
  { id: "plane", key: "4", emoji: "✈️", name: "Paper plane", does: "Throw it at someone", cooldownMs: 2000 },
  { id: "spitball", key: "5", emoji: "💦", name: "Spitball", does: "Stick it on someone", cooldownMs: 4000 },
] as const satisfies readonly Item[];
export type ItemId = (typeof ITEMS)[number]["id"];
export const ITEM_IDS = idsOf(ITEMS);
export const ITEM = byId(ITEMS);

/** What a click does until you pick something else: the coin, as clicking someone always flicked one. */
export const DEFAULT_ITEM: ItemId = "coin";

/** The item `steps` along the hotbar from `from`, going round at the ends. */
export function itemAfter(from: ItemId, steps: number): ItemId {
  const i = ITEM_IDS.indexOf(from);
  const next = ITEM_IDS[(((i + steps) % ITEM_IDS.length) + ITEM_IDS.length) % ITEM_IDS.length];
  return next ?? from;
}
