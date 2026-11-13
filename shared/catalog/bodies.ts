// Body shapes. All goofy, none dignified. Their 3D shapes live in client/src/avatar/bodies/.
import { idsOf } from "./registry.ts";

export interface Body {
  id: string;
  label: string;
  icon: string;
}

export const BODIES = [
  { id: "bean", label: "bean", icon: "🫘" },
  { id: "chonk", label: "chonk", icon: "🍔" },
  { id: "noodle", label: "noodle", icon: "🍝" },
  { id: "box", label: "box", icon: "📦" },
  { id: "pear", label: "pear", icon: "🍐" },
] as const satisfies readonly Body[];
export type BodyId = (typeof BODIES)[number]["id"];
export const BODY_IDS = idsOf(BODIES);
