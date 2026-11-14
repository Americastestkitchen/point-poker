// Answering someone's emote: when somebody emotes, you can send one straight back at them for a
// few seconds. Pure, so it's tested here; Emotes.tsx keeps the offer and draws it.
import { EMOTE, type EmoteId } from "../../../../shared/catalog/emotes.ts";
import type { PublicPlayer } from "../../../../shared/protocol.ts";
import type { GameEvent } from "../../app/events.ts";

/** Someone's emote you could answer. */
export interface Offer {
  from: string;
  emote: EmoteId;
}

/** How long after someone's emote you can still answer it. */
export const REPLY_MS = 6000;

/** The offer an event makes: someone else just emoted. Null for your own emotes and everything else. */
export function offerFrom(e: GameEvent, meId: string | undefined): Offer | null {
  if (e.t !== "fx" || e.fx.kind !== "emote" || e.from === meId) return null;
  return { from: e.from, emote: e.fx.emote };
}

/** Who an offer is from, if they're still at the table. */
export function offeredBy(offer: Offer | null, players: readonly PublicPlayer[]): PublicPlayer | null {
  return (offer && players.find((p) => p.id === offer.from)) ?? null;
}

/** What the nudge beside the emote button says. */
export const offerText = (offer: Offer, from: PublicPlayer) => `${EMOTE[offer.emote].emoji} ${from.name}`;
