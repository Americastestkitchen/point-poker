// Who owns the keyboard: the world's shortcuts (Z X C V emotes, R recenter) or the UI.
// The decisions are pure so node tests cover them; focusOf() is the one thin DOM read.
import type { AppState } from "../app/store.ts";

/**
 * Where keyboard focus is: on the page itself (nothing focused, or the canvas), a UI control
 * (a button, a link, a menu item), a text field, or anywhere inside a dialog.
 */
export type Focus = "page" | "control" | "field" | "dialog";

export interface KeyState {
  screen: AppState["screen"];
  popup: AppState["ui"]["popup"];
  lookOpen: boolean;
  /** Any kit dialog is open, popup or not (a nested confirm, the copy fallback). */
  dialogOpen: boolean;
  focus: Focus;
}

/** World shortcuts only work at the table with nothing over it and nothing in the UI focused. */
export function worldKeysAllowed(k: KeyState): boolean {
  return k.screen === "table" && k.popup === null && !k.lookOpen && !k.dialogOpen && k.focus === "page";
}

/**
 * Esc opens the table's game menu, unless something else should have it: a popup or the look
 * editor is open (they close first), or a text field is focused (it handles its own Esc).
 */
export function menuKeyAllowed(k: Omit<KeyState, "dialogOpen">): boolean {
  return k.screen === "table" && k.popup === null && !k.lookOpen && k.focus !== "field";
}

/** The kit's mark for focus that only followed the mouse (ui/focus.ts); read here without loading the kit. */
const HOVER_FOCUS = "data-hover-focus";

const FIELD = "input, textarea, select, [contenteditable]:not([contenteditable='false'])";
const CONTROL = "button, a[href], summary, [tabindex], [role='button'], [role='switch'], [role='slider'], [role='menuitem'], [role='tab'], [role='option']";

/** Where `el` (usually document.activeElement) is, as far as keys go. */
export function focusOf(el: Element | null): Focus {
  if (!el || el === el.ownerDocument.body || el === el.ownerDocument.documentElement) return "page";
  if (el.closest("[role='dialog']")) return "dialog";
  // the mouse is only resting on it (the kit focuses what you hover): nobody chose it with a
  // key or a press, so the keyboard still belongs to the page
  if (el.hasAttribute(HOVER_FOCUS)) return "page";
  if (el.closest(FIELD)) return "field";
  if (el.closest(CONTROL)) return "control";
  return "page";
}
