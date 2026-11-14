// Your hand items, as the client sees them: which one you're holding and when each is ready
// again. The server enforces the real cooldown; this one keeps a click from being sent when
// the server would only say "not so fast", and tells the hotbar what to show.
import { ITEM, type ItemId } from "../../../shared/catalog/items.ts";

/** When you last used each item, in ms on this browser's clock. */
export type ItemsUsed = Readonly<Partial<Record<ItemId, number>>>;

/**
 * A little longer than the server's cooldown: yours starts when you click and the server's when
 * the click arrives, so a click sent the instant yours ends could still land too early.
 */
const SLACK_MS = 150;

/** How long you wait before using `item` again. */
export const cooldownOf = (item: ItemId) => ITEM[item].cooldownMs + SLACK_MS;

/** How much of `item`'s cooldown is left at `now` (0 when it's ready). */
export function coolingFor(used: ItemsUsed, item: ItemId, now: number): number {
  const at = used[item];
  return at === undefined ? 0 : Math.max(0, at + cooldownOf(item) - now);
}
