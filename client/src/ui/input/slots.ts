// What CodeSlots does with typing: keep the allowed characters, uppercase, up to `length`.

export const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** The code after typing or pasting `text` onto `value`. */
export function typeInto(value: string, text: string, length: number, alphabet = LETTERS): string {
  const kept = [...text.toUpperCase()].filter((c) => alphabet.includes(c)).join("");
  return (value + kept).slice(0, length);
}

/** Read whatever the hidden input holds as a code: a paste can replace it all at once. */
export function normalize(raw: string, length: number, alphabet = LETTERS): string {
  return typeInto("", raw, length, alphabet);
}

/** The slot the next character goes into; `length` when the code is full. */
export function cursorOf(value: string, length: number): number {
  return Math.min(value.length, length);
}
