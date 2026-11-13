// What the action dock shows: a pure function of the view, who you are and the card you see as
// played (your optimistic vote). ActionDock.tsx only draws it and wires the presses.
import type { PublicPlayer, TableView } from "../../../../shared/protocol.ts";
import { cardValues, favourite, nextInQueue, tally, voters } from "../../../../shared/rules.ts";
import { names, pointsWord, safeUrl } from "../text.ts";

/** A line of words, with the part worth shouting about (a number) called out. */
export type Words = readonly (string | { strong: string })[];

/** One card in a hand you can press. */
export interface HandCard {
  value: number;
  /** Lit up: the card you played, or the final call once it's made. */
  selected: boolean;
  /** Another card is selected. */
  dimmed: boolean;
  /** The clear favourite, before the final call ("most votes"). */
  suggested: boolean;
  /** Who played it (the dealer's settle hand shows them as dots). */
  voters: PublicPlayer[];
  /** What pressing it does; null when it does nothing (the final call is already this card). */
  press: { t: "vote"; value: number } | { t: "settle"; value: number } | null;
}

/** One card in the spread of votes players see after the reveal. */
export interface SpreadCard {
  value: number;
  voters: PublicPlayer[];
  /** The dealer's final call. */
  final: boolean;
}

export type DockBody =
  /** The dealer, before there's a ticket: the big "＋ Add a Jira ticket". */
  | { t: "addTicket" }
  /** Nothing to do but wait (with a spinner). */
  | { t: "waiting"; text: string }
  /** Your hand while voting. */
  | { t: "vote"; cards: HandCard[] }
  /** The dealer picking (or changing) the final points. */
  | { t: "settle"; cards: HandCard[] }
  /** How everyone voted; empty when nobody did. */
  | { t: "spread"; cards: SpreadCard[] };

export type DockAction =
  /** Flip the cards: `voted` of `of` are in; it can't flip with nobody in; it calls out when everyone is. */
  | { t: "reveal"; voted: number; of: number; everyone: boolean }
  /** Deal the same ticket again. */
  | { t: "restart"; label: "Restart vote" | "Vote again" }
  /** Deal the next ticket in the queue. */
  | { t: "next"; key: string }
  /** Open the ticket picker: `main` is the big "＋ Next ticket", otherwise the quiet "Choose a different one". */
  | { t: "picker"; main: boolean }
  | { t: "jira"; url: string };

export interface Dock {
  /** Changes with each phase and round, so the dock plays its entrance again. */
  key: string;
  title: Words | null;
  body: DockBody | null;
  actions: DockAction[];
}

export interface DockInput {
  room: TableView;
  meId: string | undefined;
  /** The card you see as played (store `ui.myVote`), ahead of the server. */
  myVote: number | null;
}

export function dockModel({ room, meId, myVote }: DockInput): Dock {
  const key = `${room.phase}:${room.round}`;
  const playing = voters(room.players);
  const me = room.players.find((p) => p.id === meId);
  const dealer = !!me?.isDealer;
  const amVoter = playing.some((p) => p.id === meId);
  const deck = cardValues(room.settings.deck);
  const counts = tally(playing);

  switch (room.phase) {
    case "waiting":
      return dealer
        ? { key, title: null, body: { t: "addTicket" }, actions: [] }
        : { key, title: null, body: { t: "waiting", text: "The dealer is picking a ticket" }, actions: [] };

    case "voting": {
      const voted = playing.filter((p) => p.hasVoted).length;
      const everyone = voted === playing.length && voted > 0;
      let title: Words | null = null;
      let body: DockBody | null = null;
      if (amVoter) {
        title = myVote === null ? ["How big is it? Pick a card"] : ["You picked ", { strong: String(myVote) }, " · tap another card to change"];
        body = {
          t: "vote",
          cards: deck.map((value) => ({
            value, selected: value === myVote, dimmed: myVote !== null && value !== myVote, suggested: false,
            voters: [], press: { t: "vote", value },
          })),
        };
      } else if (dealer) {
        const waiting = playing.filter((p) => !p.hasVoted).map((p) => p.name);
        title = [everyone ? "Everyone's in!"
          : waiting.length ? `Waiting on ${names(waiting.slice(0, 4))}${waiting.length > 4 ? "…" : ""}`
          : "Nobody's at the table yet"];
      }
      const actions: DockAction[] = dealer
        ? [{ t: "reveal", voted, of: playing.length, everyone }, { t: "restart", label: "Restart vote" }]
        : [];
      return { key, title, body, actions };
    }

    case "revealed":
    case "settled": {
      const settled = room.phase === "settled";
      const final = room.finalPoints;
      if (!dealer) {
        const cards = deck
          .filter((v) => counts.has(v) || (settled && v === final))
          .map((value) => ({ value, voters: counts.get(value) ?? [], final: settled && value === final }));
        return {
          key,
          title: settled ? ["Final: ", { strong: String(final) }, ` ${pointsWord(final)}`] : ["Here's how everyone voted"],
          body: { t: "spread", cards },
          actions: [],
        };
      }
      // only call out a favourite when there clearly is one, and only before the call
      const top = settled ? null : favourite(counts);
      const cards: HandCard[] = deck.map((value) => ({
        value,
        selected: settled && value === final,
        dimmed: settled && value !== final,
        suggested: value === top,
        voters: counts.get(value) ?? [],
        press: value === final ? null : { t: "settle", value },
      }));
      const actions: DockAction[] = [];
      if (!settled) actions.push({ t: "restart", label: "Vote again" });
      else {
        const next = nextInQueue(room);
        if (next) actions.push({ t: "next", key: next.key }, { t: "picker", main: false });
        else actions.push({ t: "picker", main: true });
        const url = safeUrl(room.ticket?.url);
        if (url) actions.push({ t: "jira", url });
      }
      return {
        key,
        title: settled ? ["Final: ", { strong: String(final) }, ` ${pointsWord(final)} · tap a card to change it`] : ["Tap the final points"],
        body: { t: "settle", cards },
        actions,
      };
    }
  }
}

/** The words as plain text (for tests, and an accessible name). */
export const plain = (w: Words) => w.map((part) => (typeof part === "string" ? part : part.strong)).join("");
