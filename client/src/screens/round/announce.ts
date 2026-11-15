// The big moments over the room: a new ticket, the cards going up, and who takes the pot.
// Pure: the words for a change in the view, from your seat. Announcements.tsx shows them.
import type { TableView } from "../../../../shared/protocol.ts";
import { cardLabel, scores } from "../../../../shared/rules.ts";
import type { ViewChange } from "../../app/events.ts";
import { finalWords, names } from "../text.ts";

export interface Announcement {
  /** `deal` is cool blue, `reveal` the plain card, `settle` the payout. */
  kind: "deal" | "reveal" | "settle";
  /** It's about you (you won): the card glows gold. */
  mine: boolean;
  /** The small line on top ("New ticket", "Final call · 5 points"). */
  kicker: string | null;
  title: string;
  /** Coins won, shown big next to the title (`+3`). */
  amount: number | null;
  sub: string;
  /** How long it stays up. */
  ms: number;
}

const card = (a: Partial<Announcement> & Pick<Announcement, "kind" | "title" | "sub" | "ms">): Announcement => ({
  mine: false,
  kicker: null,
  amount: null,
  ...a,
});

/** What to announce for one change in the view, or null when it isn't a big moment. */
export function announcementFor(change: ViewChange, room: TableView, meId: string | undefined): Announcement | null {
  switch (change.t) {
    case "dealt":
      return room.ticket
        ? card({ kind: "deal", kicker: "New ticket", title: room.ticket.key, sub: room.ticket.summary, ms: 1800 })
        : null;
    case "revealed":
      return revealed(room);
    case "settled":
      return settled(room, meId);
    default:
      return null;
  }
}

function revealed(room: TableView): Announcement {
  const says = (value: number) => cardLabel(room.settings.deck, value);
  const votes = room.players.flatMap((p) => (p.plays && p.vote !== null ? [p.vote] : []));
  const [first] = votes;
  if (first !== undefined && votes.length > 1 && votes.every((v) => v === first)) {
    return card({
      kind: "reveal",
      title: `Everyone said ${says(first)}! 🎉`,
      // everyone on the same number is a win; everyone on "?" is a different kind of agreement
      sub: scores(first) ? "Consensus. Mark it on the calendar." : "Well, at least you agree.",
      ms: 1700,
    });
  }
  // the spread is between the cards worth points; a "?" isn't on that line
  const numbers = votes.filter(scores);
  return card({
    kind: "reveal",
    title: "Cards up!",
    ms: 1700,
    sub: numbers.length
      ? numbers.length < votes.length && Math.min(...numbers) === Math.max(...numbers)
        ? `Every number on the table is ${says(Math.min(...numbers))}`
        : `From ${says(Math.min(...numbers))} to ${says(Math.max(...numbers))}`
      : votes.length
        ? "Not a number among them"
        : "Nobody picked a card",
  });
}

function settled(room: TableView, meId: string | undefined): Announcement {
  const winners = room.players.filter((p) => room.winners.includes(p.id));
  const iWon = meId !== undefined && room.winners.includes(meId);
  const kicker = `Final call · ${finalWords(room.settings.deck, room.finalPoints)}`;
  /** The final card as it's named mid-sentence: "5", "XL". */
  const final = room.finalPoints === null ? "" : cardLabel(room.settings.deck, room.finalPoints);
  const share = room.share;

  if (room.houseWon) {
    const why = `Nobody was within one card of ${final}.`;
    return iWon
      ? card({
          kind: "settle",
          mine: true,
          kicker,
          title: "House wins",
          amount: share,
          sub: `${why} You rake in the pot.`,
          ms: 2800,
        })
      : card({
          kind: "settle",
          kicker,
          title: "House wins",
          sub: `${why} ${winners[0]?.name ?? "The dealer"} rakes in 🪙 +${share}`,
          ms: 2800,
        });
  }
  if (!winners.length) {
    const played = room.players.some((p) => p.vote !== null);
    const why = !played
      ? "Nobody picked a card."
      : room.pot > 0
        ? `Nobody was within one card of ${final}.`
        : "Nobody was close, but the pot was empty anyway.";
    return card({ kind: "settle", kicker, title: "House wins", sub: why, ms: 2600 });
  }
  if (iWon) {
    const others = winners.filter((p) => p.id !== meId).map((p) => p.name);
    return card({
      kind: "settle",
      mine: true,
      kicker,
      title: "You win",
      amount: share,
      ms: 2800,
      sub: winners.length > 1 ? `Split with ${names(others)}` : "The whole pot is yours",
    });
  }
  const split = winners.length > 1;
  return card({
    kind: "settle",
    kicker,
    ms: 2600,
    title: `${names(winners.map((p) => p.name))} ${split ? "split the pot" : "takes the pot"}`,
    sub: `🪙 +${share}${split ? " each" : ""}`,
  });
}
