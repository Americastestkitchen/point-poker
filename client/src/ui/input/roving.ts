// Moving focus through a list (a menu, the options of a carousel), skipping what's disabled.

export interface StepOptions {
  /** Past the last item comes the first again. */
  wrap?: boolean;
  /** Items that can't take focus. */
  disabled?: (index: number) => boolean;
}

/**
 * The index one step from `current` in `dir`, or `current` when there's nowhere to go.
 * A `current` of -1 (nothing focused yet) starts from the first enabled item going down,
 * or the last going up.
 */
export function step(current: number, count: number, dir: -1 | 1, opts: StepOptions = {}): number {
  const { wrap = true, disabled = () => false } = opts;
  if (count <= 0) return -1;
  let i = current < 0 ? (dir === 1 ? -1 : count) : current;
  for (let n = 0; n < count; n++) {
    i += dir;
    if (i < 0 || i >= count) {
      if (!wrap) return current;
      i = (i + count) % count;
    }
    if (!disabled(i)) return i;
  }
  return current;
}

/** The first item that can take focus, or -1. */
export function first(count: number, disabled: (index: number) => boolean = () => false): number {
  return step(-1, count, 1, { wrap: false, disabled });
}
