// Remembers the house rules you deal with (the cards, whether you play, the room), so your
// next table opens the same way: opening one sends them along (tables.ts).
import { choiceOf } from "../../../shared/catalog/decks.ts";
import type { HouseRules, TableView } from "../../../shared/protocol.ts";
import type { Storage } from "./storage.ts";
import { myPlayer, type Store } from "./store.ts";

/** The house rules a table is playing by. */
export const rulesOf = (room: Pick<TableView, "settings" | "environment">): Required<HouseRules> => ({
  deck: choiceOf(room.settings.deck),
  dealerPlays: room.settings.dealerPlays,
  environment: room.environment,
});

/** Saves the rules of the table you deal whenever they change. Returns a function that stops it. */
export function rememberHouseRules(store: Pick<Store, "subscribe">, storage: Pick<Storage, "setHouseRules">) {
  let saved = "";
  return store.subscribe((s) => {
    if (!s.room || !myPlayer(s)?.isDealer) return;
    const rules = rulesOf(s.room);
    const text = JSON.stringify(rules);
    if (text === saved) return;
    saved = text;
    storage.setHouseRules(rules);
  });
}
