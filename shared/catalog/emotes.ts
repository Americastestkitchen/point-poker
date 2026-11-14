// Emotes: the emoji that floats up, what it's called on the emote wheel, and for the first
// four a key to press. The order is the order round the wheel, from the top.
import { byId, idsOf } from "./registry.ts";

export interface Emote {
  id: string;
  /** A key that plays it straight away, or null when it's only on the wheel. */
  key: string | null;
  emoji: string;
  name: string;
}

export const EMOTES = [
  { id: "wave", key: "z", emoji: "👋", name: "Wave" },
  { id: "laugh", key: "x", emoji: "😂", name: "Laugh" },
  { id: "think", key: "c", emoji: "🤔", name: "Think" },
  { id: "shock", key: "v", emoji: "😱", name: "Gasp" },
  { id: "thumbs", key: null, emoji: "👍", name: "Nice one" },
  { id: "party", key: null, emoji: "🎉", name: "Party" },
  { id: "sleepy", key: null, emoji: "😴", name: "Yawn" },
  { id: "love", key: null, emoji: "❤️", name: "Love it" },
] as const satisfies readonly Emote[];
export type EmoteId = (typeof EMOTES)[number]["id"];
export const EMOTE_IDS = idsOf(EMOTES);
export const EMOTE = byId(EMOTES);
export const isEmote = (id: string): id is EmoteId => Object.hasOwn(EMOTE, id);

/** The key that opens the emote wheel. */
export const EMOTE_WHEEL_KEY = "e";
