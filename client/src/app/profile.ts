// The look editor's draft of you: your name and look as you change them. A
// pure reducer, so the editor (and later a React component) only says what
// the player did.
import type { BodyId } from "../../../shared/catalog/bodies.ts";
import type { Color } from "../../../shared/catalog/colors.ts";
import type { CosmeticId, Slot } from "../../../shared/catalog/cosmetics.ts";
import { wear } from "../../../shared/look.ts";
import type { Profile } from "./storage.ts";

export type ProfileAction =
  | { t: "name"; name: string }
  | { t: "color"; color: Color }
  | { t: "body"; body: BodyId }
  /** Put `id` on in `slot`, or take off what's there with null. */
  | { t: "wear"; slot: Slot; id: CosmeticId | null };

export function editProfile(p: Profile, a: ProfileAction): Profile {
  switch (a.t) {
    case "name":
      return { ...p, name: a.name };
    case "color":
      return { ...p, look: { ...p.look, color: a.color } };
    case "body":
      return { ...p, look: { ...p.look, body: a.body } };
    case "wear":
      return { ...p, look: wear(p.look, a.slot, a.id) };
    default:
      return a satisfies never;
  }
}

/** The profile to sit down with (name trimmed), or null while there's no name yet. */
export function readyToSit(p: Profile): Profile | null {
  const name = p.name.trim();
  return name ? { ...p, name } : null;
}
