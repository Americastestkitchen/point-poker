// Bean colours.
export const COLORS = [
  "#ff6b4a", "#ffd23f", "#3bceac", "#5b8cff", "#c56bff",
  "#ff5fa2", "#8ce05a", "#ff9f1c", "#4ad6ff", "#e8e1d0",
] as const;
export type Color = (typeof COLORS)[number];
