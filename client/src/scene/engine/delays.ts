// Things to do after a while, counted in frame time. A hidden tab or a slow
// frame holds them back together with every animation; setTimeout wouldn't.

export interface Delays {
  /** Runs `fn` once, after `seconds` of frame time. */
  after(seconds: number, fn: () => void): void;
  update(dt: number): void;
}

export function createDelays(): Delays {
  let waiting: { left: number; fn: () => void }[] = [];
  return {
    after(seconds, fn) {
      waiting.push({ left: seconds, fn });
    },
    update(dt) {
      if (!waiting.length) return;
      for (const w of waiting) w.left -= dt;
      const due = waiting.filter((w) => w.left <= 0);
      // what the due ones schedule waits for the next frame
      waiting = waiting.filter((w) => w.left > 0);
      for (const w of due) w.fn();
    },
  };
}
