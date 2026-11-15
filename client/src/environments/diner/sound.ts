// The diner's background noise: the fryer sizzling now and then, the odd clink of a
// plate, and the jukebox's doo-wop bass, heard from the other end of the room.
// Both are baked into loops once, so nothing has to be scheduled while it plays.
import type { EnvCtx } from "../types.ts";

type Bed = Parameters<EnvCtx["sound"]["bed"]>[0];

/** Seconds; the two loops differ so they don't line up the same way every time. */
const FRYER_LOOP = 23.3; // long enough that you don't hear it go round
const JUKEBOX_LOOP = 16; // eight bars of four beats at 120 bpm

function loop(c: AudioContext, seconds: number, fill: (d: Float32Array, rate: number) => void) {
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * seconds), c.sampleRate);
  fill(buf.getChannelData(0), c.sampleRate);
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  return src;
}

/**
 * A soft sizzle that comes and goes: busy for a while, then barely there. Fat pops
 * now and then, more of them while it's busy, and a few plates set down. The swell
 * goes round a whole number of times per loop, so the loop joins without a seam.
 */
function fryer(d: Float32Array, rate: number) {
  const fade = Math.exp(-1 / (rate * 0.004)); // a pop dies away in a few milliseconds
  let pop = 0;
  for (let i = 0; i < d.length; i++) {
    const turn = (i / rate / FRYER_LOOP) * Math.PI * 2;
    const busy = (0.5 - 0.5 * Math.cos(turn)) * (0.75 + 0.25 * Math.sin(turn * 3));
    const swell = 0.15 + 0.85 * busy ** 1.5 + 0.06 * Math.sin(turn * 11);
    if (Math.random() < (5 * busy) / rate) pop = Math.max(pop, 0.15 + Math.random() * 0.2);
    d[i] = (Math.random() * 2 - 1) * (swell * 0.4 + pop);
    pop *= fade;
  }
  for (const at of [3.1, 11.8, 19.4]) {
    const start = Math.floor(at * rate);
    for (let i = 0; i < rate * 0.6 && start + i < d.length; i++) {
      const t = i / rate;
      const ring = Math.exp(-t * 9) * (Math.sin(t * 3150 * 2 * Math.PI) + 0.6 * Math.sin(t * 4720 * 2 * Math.PI));
      d[start + i] = (d[start + i] ?? 0) + ring * 0.3;
    }
  }
}

// C, A minor, F, G, twice: root, third, fifth, sixth, walking up.
const BASS = [
  [65.4, 82.4, 98.0, 110.0],
  [55.0, 65.4, 82.4, 98.0],
  [87.3, 110.0, 130.8, 146.8],
  [98.0, 123.5, 146.8, 164.8],
];

function walkingBass(d: Float32Array, rate: number) {
  const beat = 0.5;
  for (let n = 0; n < 32; n++) {
    const freq = BASS[Math.floor(n / 4) % BASS.length]?.[n % 4] ?? 65.4;
    const start = Math.floor(n * beat * rate);
    for (let i = 0; i < beat * rate && start + i < d.length; i++) {
      const t = i / rate;
      const env = Math.min(1, t * 80) * Math.exp(-t * 3);
      const w = 2 * Math.PI * freq * t;
      d[start + i] = env * (Math.sin(w) + 0.35 * Math.sin(2 * w)) * 0.6;
    }
  }
}

export const dinerAmbience: Bed = (c, out) => {
  const sizzle = loop(c, FRYER_LOOP, fryer);
  // lower than a hiss and with the top taken off, so it doesn't grate
  const hiss = c.createBiquadFilter();
  hiss.type = "highpass";
  hiss.frequency.value = 900;
  const soft = c.createBiquadFilter();
  soft.type = "lowpass";
  soft.frequency.value = 6000;
  const sizzleGain = c.createGain();
  sizzleGain.gain.value = 0.011;
  sizzle.connect(hiss).connect(soft).connect(sizzleGain).connect(out);

  const bass = loop(c, JUKEBOX_LOOP, walkingBass);
  const far = c.createBiquadFilter();
  far.type = "lowpass";
  far.frequency.value = 420;
  const bassGain = c.createGain();
  bassGain.gain.value = 0.03;
  bass.connect(far).connect(bassGain).connect(out);

  sizzle.start();
  bass.start();
  return () => {
    sizzle.stop();
    bass.stop();
  };
};
