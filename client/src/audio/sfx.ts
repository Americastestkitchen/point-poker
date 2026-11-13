// Tiny synthesized sound effects and ambience, so there are no audio assets to ship.
import type { Storage } from "../app/storage.ts";

export type AmbienceId = "basement";

export function createAudio(storage: Pick<Storage, "muted" | "setMuted">) {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let muted = storage.muted();
  let ambience: AmbienceId | null = null;
  let hum: OscillatorNode | null = null;

  function ac(): AudioContext | null {
    if (muted) return null;
    if (!ctx) {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  }

  function tone(freq: number, dur: number, type: OscillatorType = "sine", vol = 0.3, slideTo?: number, delay = 0) {
    const c = ac();
    if (!c || !master) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noise(dur: number, freq: number, vol = 0.3, delay = 0) {
    const c = ac();
    if (!c || !master) return;
    const t = c.currentTime + delay;
    const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = freq;
    const g = c.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(master);
    src.start(t);
  }

  /** Looping background sound for an environment. */
  function startAmbience() {
    const c = ac();
    if (!c || !master || hum || !ambience) return;
    // the basement lamp's mains hum, barely there
    hum = c.createOscillator();
    hum.frequency.value = 60;
    const g = c.createGain();
    g.gain.value = 0.015;
    hum.connect(g).connect(master);
    hum.start();
  }

  const audio = {
    get muted() { return muted; },
    setMuted(m: boolean) {
      muted = m;
      storage.setMuted(m);
      if (m && ctx) { void ctx.suspend(); }
      if (!m) { ac(); startAmbience(); }
    },
    ambience(id: AmbienceId) {
      ambience = id;
      startAmbience();
    },
    slide: () => noise(0.18, 2400, 0.25),
    flip: (delay = 0) => { noise(0.05, 4000, 0.35, delay); tone(900, 0.05, "triangle", 0.08, 600, delay); },
    chip: (delay = 0) => { tone(2400 + Math.random() * 500, 0.08, "sine", 0.12, undefined, delay); tone(3600, 0.05, "sine", 0.06, undefined, delay + 0.02); },
    bonk: () => { tone(520, 0.25, "sine", 0.35, 140); noise(0.06, 1200, 0.2); },
    squeak: () => tone(1400, 0.18, "square", 0.06, 2200),
    hover: () => tone(1800, 0.03, "sine", 0.03),
    pop: () => tone(600, 0.1, "triangle", 0.15, 1200),
    /** UI kit: a button or menu item was chosen. */
    confirm: () => { tone(660, 0.07, "triangle", 0.12); tone(990, 0.09, "triangle", 0.1, undefined, 0.05); },
    /** UI kit: Esc, or a dialog closed. */
    back: () => tone(700, 0.1, "triangle", 0.1, 420),
    deal: () => { for (let i = 0; i < 5; i++) noise(0.06, 3000, 0.2, i * 0.07); },
    win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, "triangle", 0.15, undefined, i * 0.09)),
  };
  return audio;
}

export type Audio = ReturnType<typeof createAudio>;
