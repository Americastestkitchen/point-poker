// Dice rooms roll: how long until the next blink, which shade a tile gets.

/** A number somewhere from `min` up to `max`. */
export const between = (min: number, max: number) => min + Math.random() * (max - min);

/** Any one of `list`. */
export const oneOf = <T>(list: readonly [T, ...T[]]): T => list[Math.floor(Math.random() * list.length)] ?? list[0];

/** A cheap repeatable hash of two numbers, 0..1: the same pair always gives the same answer. */
export const jitter = (a: number, b: number) => {
  const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return s - Math.floor(s);
};
