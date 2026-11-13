// One input model for the whole UI: keys, mouse and touch all become the same few intents.
// Arrow keys move focus, Enter or Space confirms, Esc goes back.

export type Intent = "up" | "down" | "left" | "right" | "confirm" | "back";

export interface KeyLike {
  key: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
}

const KEYS: Record<string, Intent> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  Enter: "confirm",
  " ": "confirm",
  Escape: "back",
};

/** The intent behind a key press, or null for keys the UI leaves alone (and any shortcut). */
export function intentOf(e: KeyLike): Intent | null {
  if (e.altKey || e.ctrlKey || e.metaKey) return null;
  return KEYS[e.key] ?? null;
}

export type Orientation = "vertical" | "horizontal";

/** Which way an intent moves along a list: -1, +1, or 0 when it doesn't move it. */
export function direction(intent: Intent | null, orientation: Orientation): -1 | 0 | 1 {
  if (orientation === "vertical") return intent === "up" ? -1 : intent === "down" ? 1 : 0;
  return intent === "left" ? -1 : intent === "right" ? 1 : 0;
}
