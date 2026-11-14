// Everything the player can do. The UI and the scene call these; nothing else
// talks to the server. Dealer actions return promises that settle when the
// server answers, and reject with its reason (like a Jira error).
import type { Command } from "../../../server/table/commands.ts";
import type { EmoteId } from "../../../shared/catalog/emotes.ts";
import type { EnvironmentId } from "../../../shared/catalog/environments.ts";
import { itemAfter, type ItemId } from "../../../shared/catalog/items.ts";
import type { Look } from "../../../shared/look.ts";
import { coolingFor } from "./items.ts";
import type { Session } from "./session.ts";
import { myPlayer, type Store } from "./store.ts";

export function createActions(
  session: Pick<Session, "request" | "fx">,
  store: Store,
  /** This browser's clock in ms, for item cooldowns. */
  now: () => number = Date.now,
) {
  const run = (cmd: Command) => session.request(cmd);
  /** For actions nobody waits on: a failure shows up as a toast. */
  const report = (e: unknown) =>
    store.events.emit({ t: "toast", text: e instanceof Error ? e.message : String(e), level: "error" });

  return {
    /** Put a card down (or swap the one you put down, even after the reveal until the dealer calls it). */
    vote(value: number) {
      const s = store.getState();
      const phase = s.room?.phase;
      const open = phase === "voting" || (phase === "revealed" && s.ui.myVote !== null);
      if (!open || !myPlayer(s)?.plays || s.ui.myVote === value) return;
      const changed = s.ui.myVote !== null;
      store.vote({ t: "played", value });
      store.events.emit({ t: "played", value, changed });
      const answered = () => store.vote({ t: "answered" });
      run({ t: "vote", value }).then(answered, (e: unknown) => {
        answered();
        report(e);
      });
    },
    items: {
      /** Pick a hand item on the hotbar. */
      pick: (item: ItemId) => store.itemPicked(item),
      /** Move along the hotbar (the scroll wheel): 1 is the next item, -1 the one before. */
      cycle: (steps: number) => store.itemPicked(itemAfter(store.getState().ui.item, steps)),
      /** How long until `item` can be used again, in ms (0 when it's ready). */
      cooling: (item: ItemId) => coolingFor(store.getState().ui.itemsUsed, item, now()),
      /** Use the item you've picked on someone. While it's cooling down nothing happens. */
      use(target: string) {
        const { item, itemsUsed } = store.getState().ui;
        const at = now();
        if (coolingFor(itemsUsed, item, at) > 0) return;
        store.itemUsed(item, at);
        // nobody waits on it: a refusal (they just left, the server's clock disagrees) isn't worth a toast
        run({ t: "use", item, target }).catch(() => {});
      },
    },
    emote: (emote: EmoteId) => session.fx({ kind: "emote", emote }),
    /** You clicked the squeaky (it already squeaked for you): everyone else hears it too. */
    squeak: () => session.fx({ kind: "squeak" }),
    /** Where you're looking, relative to facing the table. */
    gaze: (yaw: number, pitch: number) => session.fx({ kind: "gaze", yaw, pitch }),
    /** Mic loudness 0..1 (never audio). */
    talk: (level: number) => session.fx({ kind: "talk", level }),
    setLook: (look: Look) => {
      run({ t: "setLook", look }).catch(report);
    },
    openTicket: () => store.events.emit({ t: "openTicket" }),

    dealer: {
      /** Loads a Jira ticket (or an epic's tickets) and deals it. */
      load: (ref: string) => run({ t: "loadTicket", ref }),
      typeIn: (summary: string) => run({ t: "manualTicket", key: "", summary, description: "" }),
      loadSprint: () => run({ t: "fetchQueue" }),
      clearQueue: () => run({ t: "clearQueue" }),
      setPlays: (plays: boolean) => run({ t: "dealerPlays", plays }),
      /** Moves the table to another room, for everyone. */
      moveTo: (environment: EnvironmentId) => run({ t: "setEnvironment", environment }),
      deal: () => run({ t: "deal" }),
      reveal: () => run({ t: "reveal" }),
      settle: (finalPoints: number) => run({ t: "settle", finalPoints }),
      next: () => run({ t: "nextRound" }),
      cancel: () => run({ t: "cancelRound" }),
      skip: () => run({ t: "skip" }),
      /** Fetches the ticket that's out from Jira again; votes and the round stay. */
      refresh: () => run({ t: "refreshTicket" }),
      kick: (id: string) => run({ t: "kick", id }),
    },
  };
}

export type Actions = ReturnType<typeof createActions>;
