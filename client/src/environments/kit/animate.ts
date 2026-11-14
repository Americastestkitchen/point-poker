// Little motions rooms share, run in frame time.

/** A springy wobble: kick it, and what `step` returns each frame rings down to 0. */
export function wobble(rate = 14, damping = 4) {
  let amp = 0;
  let t = 0;
  return {
    kick(by = 1) {
      amp = by;
      t = 0;
    },
    step(dt: number) {
      if (amp === 0) return 0;
      t += dt;
      const left = Math.exp(-damping * t);
      if (left < 0.01) amp = 0; // rung down: stop for good
      return amp * left * Math.sin(rate * t);
    },
  };
}

/**
 * A one-off that runs from 1 down to 0 over `seconds`: a hop, a squash, a flash.
 * `kick` starts it (again). `step` runs it each frame and gives what's left, 1 → 0,
 * or null once it's over; the frame it reaches 0 still gives 0, so things settle back.
 */
export function oneShot(seconds: number) {
  let left = 0;
  return {
    kick() {
      left = 1;
    },
    /** What's left, 1 → 0; 0 when it isn't running. */
    get left() {
      return left;
    },
    step(dt: number): number | null {
      if (left <= 0) return null;
      left = Math.max(0, left - dt / seconds);
      return left;
    },
  };
}

/** Up and back down as a one-shot runs out, 0 → 1 → 0: the height of a hop. */
export const arc = (left: number) => Math.sin(left * Math.PI);

/**
 * A light on the blink. Now and then (every `every` seconds, first after `first`)
 * or when `burst()` is called, it stutters off and on for `length` seconds.
 * `step` says whether it's lit this frame. `onBurst` and `onRelight` are for the
 * buzz and the tink.
 */
export function blinker(opts: {
  every?: readonly [min: number, max: number];
  first?: readonly [min: number, max: number];
  length: readonly [min: number, max: number];
  /** How often it's lit while stuttering, 0..1. */
  lit?: number;
  onBurst?(): void;
  onRelight?(): void;
}) {
  const between = (r: readonly [number, number]) => r[0] + Math.random() * (r[1] - r[0]);
  let next = opts.every ? between(opts.first ?? opts.every) : Infinity;
  let left = 0;
  let flip = 0;
  let lit = true;
  const burst = () => {
    left = between(opts.length);
    opts.onBurst?.();
  };
  return {
    burst,
    step(dt: number): boolean {
      next -= dt;
      if (next <= 0 && opts.every) {
        next = between(opts.every);
        burst();
      }
      if (left <= 0) return (lit = true);
      left -= dt;
      flip -= dt;
      if (flip <= 0) {
        flip = 0.04 + Math.random() * 0.06;
        const now = left <= 0 || Math.random() < (opts.lit ?? 0.55);
        if (now && !lit) opts.onRelight?.();
        lit = now;
      }
      return lit;
    },
  };
}
