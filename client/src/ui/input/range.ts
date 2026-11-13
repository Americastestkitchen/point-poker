// Slider and CoinCounter maths.

export interface Range { min: number; max: number; step: number }

/** `value` clamped into the range and snapped to its step. */
export function snap(value: number, { min, max, step }: Range): number {
  const clamped = Math.min(max, Math.max(min, value));
  const snapped = min + Math.round((clamped - min) / step) * step;
  // keep 0.1 steps from drifting into 0.30000000000000004
  return Math.min(max, Number(snapped.toFixed(10)));
}

/** The value under a pointer at `x` on a track starting at `left` that is `width` wide. */
export function valueAt(x: number, left: number, width: number, range: Range): number {
  const t = width > 0 ? (x - left) / width : 0;
  return snap(range.min + t * (range.max - range.min), range);
}

/** How far along the track `value` sits, 0 to 1. */
export function fraction(value: number, { min, max }: Range): number {
  return max === min ? 0 : (Math.min(max, Math.max(min, value)) - min) / (max - min);
}

/** A count rolling from `from` to `to`, `t` (0 to 1) of the way through; eases out. */
export function countAt(from: number, to: number, t: number): number {
  const k = Math.min(1, Math.max(0, t));
  const eased = 1 - (1 - k) ** 3;
  return Math.round(from + (to - from) * eased);
}
