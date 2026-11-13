// The big moments over the room: a new ticket, the cards going up, and who takes the pot.
// Pure: the words for a change in the view, from your seat. Announcements.tsx shows them.
import type { TableView } from "../../../../shared/protocol.ts";
import type { ViewChange } from "../../app/events.ts";
import { names } from "../text.ts";

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

const card = (a: Partial<Announcement> & Pick<Announcement, "kind" | "title" | "sub" | "ms">): Announcement =>
  ({ mine: false, kicker: null, amount: null, ...a });

/** What to announce for one change in the view, or null when it isn't a big moment. */
export function announcementFor(change: ViewChange, room: TableView, meId: string | undefined): Announcement | null {
  switch (change.t) {
    case "dealt":
      return room.ticket ? card({ kind: "deal", kicker: "New ticket", title: room.ticket.key, sub: room.ticket.summary, ms: 1800 }) : null;
    case "revealed":
      return revealed(room);
    case "settled":
      return settled(room, meId);
    default:
      return null;
  }
}

function revealed(room: TableView): Announcement {
  const votes = room.players.flatMap((p) => (p.plays && p.vote !== null ? [p.vote] : []));
  const [first] = votes;
  if (first !== undefined && votes.length > 1 && votes.every((v) => v === first)) {
    return card({ kind: "reveal", title: `Everyone said ${first}! 🎉`, sub: "Consensus. Mark it on the calendar.", ms: 1700 });
  }
  return card({
    kind: "reveal", title: "Cards up!", ms: 1700,
    sub: votes.length ? `From ${Math.min(...votes)} to ${Math.max(...votes)}` : "Nobody picked a card",
  });
}

function settled(room: TableView, meId: string | undefined): Announcement {
  const winners = room.players.filter((p) => room.winners.includes(p.id));
  const iWon = meId !== undefined && room.winners.includes(meId);
  const kicker = `Final call · ${room.finalPoints} points`;
  const share = room.share;

  if (room.houseWon) {
    const why = `Nobody was within one card of ${room.finalPoints}.`;
    return iWon
      ? card({ kind: "settle", mine: true, kicker, title: "House wins", amount: share, sub: `${why} You rake in the pot.`, ms: 2800 })
      : card({ kind: "settle", kicker, title: "House wins", sub: `${why} ${winners[0]?.name ?? "The dealer"} rakes in 🪙 +${share}`, ms: 2800 });
  }
  if (!winners.length) {
    const played = room.players.some((p) => p.vote !== null);
    const why = !played ? "Nobody picked a card."
      : room.pot > 0 ? `Nobody was within one card of ${room.finalPoints}.`
      : "Nobody was close, but the pot was empty anyway.";
    return card({ kind: "settle", kicker, title: "House wins", sub: why, ms: 2600 });
  }
  if (iWon) {
    const others = winners.filter((p) => p.id !== meId).map((p) => p.name);
    return card({
      kind: "settle", mine: true, kicker, title: "You win", amount: share, ms: 2800,
      sub: winners.length > 1 ? `Split with ${names(others)}` : "The whole pot is yours",
    });
  }
  const split = winners.length > 1;
  return card({
    kind: "settle", kicker, ms: 2600,
    title: `${names(winners.map((p) => p.name))} ${split ? "split the pot" : "takes the pot"}`,
    sub: `🪙 +${share}${split ? " each" : ""}`,
  });
}
