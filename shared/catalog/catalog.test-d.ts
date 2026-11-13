// What the catalog lists and their helpers infer, checked by the compiler (nothing runs here).
import { assertType, type Equal } from "../../test/types.ts";
import { BODY_IDS, type BodyId } from "./bodies.ts";
import { COSMETIC, type CosmeticId } from "./cosmetics.ts";
import type { DeckId } from "./decks.ts";
import { EMOTE, isEmote, type EmoteId } from "./emotes.ts";
import type { EnvironmentId } from "./environments.ts";
import { idsOf } from "./registry.ts";

// Ids stay literal unions; if one widened to string, Record<Id, …> registries would stop catching missing entries.
type Widened<T> = string extends T ? true : false;
assertType<Equal<Widened<BodyId>, false>>();
assertType<Equal<Widened<CosmeticId>, false>>();
assertType<Equal<Widened<EmoteId>, false>>();
assertType<Equal<Widened<EnvironmentId>, false>>();
assertType<Equal<Widened<DeckId>, false>>();

// idsOf gives z.enum its non-empty tuple, and refuses an empty list.
assertType<Equal<typeof BODY_IDS, [BodyId, ...BodyId[]]>>();
// @ts-expect-error an empty catalog has no ids
idsOf([] as const);

// byId keys by id and keeps each entry's exact type.
assertType<Equal<keyof typeof COSMETIC, CosmeticId>>();
assertType<Equal<(typeof COSMETIC)["crown"]["slots"], readonly ["head"]>>();
assertType<Equal<(typeof EMOTE)["wave"]["emoji"], "👋">>();

// isEmote narrows a string to an emote id.
export function narrows(clip: string) {
  if (isEmote(clip)) assertType<Equal<typeof clip, EmoteId>>();
}
