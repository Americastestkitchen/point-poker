// Body shapes. All goofy, none dignified. Their 3D shapes live in client/src/avatar/.
export const BODIES = [
  { id: "bean", label: "bean", icon: "🫘" },
  { id: "chonk", label: "chonk", icon: "🍔" },
  { id: "noodle", label: "noodle", icon: "🍝" },
  { id: "box", label: "box", icon: "📦" },
  { id: "pear", label: "pear", icon: "🍐" },
] as const;
export type BodyId = (typeof BODIES)[number]["id"];
export const BODY_IDS = BODIES.map((b) => b.id) as [BodyId, ...BodyId[]];
