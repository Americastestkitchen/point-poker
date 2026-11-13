// Emotes: a key to press and the emoji that floats up.
export const EMOTES = [
  { id: "wave", key: "z", emoji: "👋" },
  { id: "laugh", key: "x", emoji: "😂" },
  { id: "think", key: "c", emoji: "🤔" },
  { id: "shock", key: "v", emoji: "😱" },
] as const;
export type EmoteId = (typeof EMOTES)[number]["id"];
export const EMOTE_IDS = EMOTES.map((e) => e.id) as [EmoteId, ...EmoteId[]];
