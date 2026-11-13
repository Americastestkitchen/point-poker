// Bean colours.
export const COLORS = [
  "#ff6b4a",
  "#ffd23f",
  "#3bceac",
  "#5b8cff",
  "#c56bff",
  "#ff5fa2",
  "#8ce05a",
  "#ff9f1c",
  "#4ad6ff",
  "#e8e1d0",
] as const;
export type Color = (typeof COLORS)[number];

/** What each colour is called in character select. */
export const COLOR_NAMES: Record<Color, string> = {
  "#ff6b4a": "tomato",
  "#ffd23f": "mustard",
  "#3bceac": "mint",
  "#5b8cff": "blueberry",
  "#c56bff": "grape",
  "#ff5fa2": "bubblegum",
  "#8ce05a": "lime",
  "#ff9f1c": "tangerine",
  "#4ad6ff": "sky",
  "#e8e1d0": "oat",
};
