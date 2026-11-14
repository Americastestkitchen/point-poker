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
