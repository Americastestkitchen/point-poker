// The diner's background noise: the fryer sizzling with the odd clink of a
// plate, and the jukebox's doo-wop bass, heard from the other end of the room.
// Both are baked into loops once, so nothing has to be scheduled while it plays.
import type { EnvCtx } from "../types.ts";

type Bed = Parameters<EnvCtx["sound"]["bed"]>[0];

/** Seconds; the two loops differ so they don't line up the same way every time. */
const FRYER_LOOP = 7.3;
const JUKEBOX_LOOP = 16; // eight bars of four beats at 120 bpm

function loop(c: AudioContext, seconds: number, fill: (d: Float32Array, rate: number) => void) {
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * seconds), c.sampleRate);
  fill(buf.getChannelData(0), c.sampleRate);
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  return src;
}

/** Hiss that swells and settles, with pops of fat and a couple of plates set down. */
function fryer(d: Float32Array, rate: number) {
  for (let i = 0; i < d.length; i++) {
    const t = i / rate;
    const swell = 0.6 + 0.25 * Math.sin((t / FRYER_LOOP) * Math.PI * 2 * 3) + 0.15 * Math.sin(t * 5.1);
    d[i] = (Math.random() * 2 - 1) * swell * 0.5;
    if (Math.random() < 0.0006) d[i] = (Math.random() < 0.5 ? -1 : 1) * 0.9; // a pop
  }
  for (const at of [1.7, 5.2]) {
    const start = Math.floor(at * rate);
    for (let i = 0; i < rate * 0.6 && start + i < d.length; i++) {
      const t = i / rate;
      const ring = Math.exp(-t * 9) * (Math.sin(t * 3150 * 2 * Math.PI) + 0.6 * Math.sin(t * 4720 * 2 * Math.PI));
      d[start + i] = (d[start + i] ?? 0) + ring * 0.35;
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
  const hiss = c.createBiquadFilter();
  hiss.type = "highpass";
  hiss.frequency.value = 2200;
  const sizzleGain = c.createGain();
  sizzleGain.gain.value = 0.012;
  sizzle.connect(hiss).connect(sizzleGain).connect(out);

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
