// Emotes: a key to press and the emoji that floats up.
import { byId, idsOf } from "./registry.ts";

export interface Emote {
  id: string;
  key: string;
  emoji: string;
}

export const EMOTES = [
  { id: "wave", key: "z", emoji: "👋" },
  { id: "laugh", key: "x", emoji: "😂" },
  { id: "think", key: "c", emoji: "🤔" },
  { id: "shock", key: "v", emoji: "😱" },
] as const satisfies readonly Emote[];
export type EmoteId = (typeof EMOTES)[number]["id"];
export const EMOTE_IDS = idsOf(EMOTES);
export const EMOTE = byId(EMOTES);
export const isEmote = (id: string): id is EmoteId => Object.hasOwn(EMOTE, id);
