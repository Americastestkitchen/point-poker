// Tiny synthesized sound effects and ambience, so there are no audio assets to ship.
import type { Storage } from "../app/storage.ts";

/** Builds a looping sound into `out` and returns how to stop it. */
export type Bed = (c: AudioContext, out: AudioNode) => () => void;

/** A room's own sounds. They play through one channel, so the room can fade out as a whole. */
export interface RoomSound {
  tone(freq: number, dur: number, type?: OscillatorType, vol?: number, slideTo?: number, delay?: number): void;
  noise(dur: number, freq: number, vol?: number, delay?: number): void;
  /** Loops `bed` while the room is up. It starts once there's sound at all: a muted game has none yet. */
  bed(bed: Bed): void;
  /** Fades the room's sounds out and stops them. */
  dispose(): void;
}

/** How long a room takes to fade in or out, in seconds. */
const ROOM_FADE = 0.8;

export function createAudio(storage: Pick<Storage, "muted" | "setMuted">) {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let muted = storage.muted();
  /** Rooms waiting for sound to exist, or playing. */
  const rooms = new Set<() => void>();

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

  /** Where a sound goes, asked once there's sound at all. */
  type Dest = () => AudioNode | null;
  const toMaster: Dest = () => master;

  function tone(
    dest: Dest,
    freq: number,
    dur: number,
    type: OscillatorType = "sine",
    vol = 0.3,
    slideTo?: number,
    delay = 0,
  ) {
    const c = ac();
    const out = dest();
    if (!c || !out) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noise(dest: Dest, dur: number, freq: number, vol = 0.3, delay = 0) {
    const c = ac();
    const out = dest();
    if (!c || !out) return;
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
    src.connect(f).connect(g).connect(out);
    src.start(t);
  }

  function room(): RoomSound {
    const beds: Bed[] = [];
    const stops: (() => void)[] = [];
    let out: GainNode | null = null;
    let gone = false;
    /** Opens the room's channel and starts its beds, once there's sound to play them on. */
    const wake = () => {
      if (gone || out) return;
      const c = ac();
      if (!c || !master) return;
      out = c.createGain();
      out.gain.setValueAtTime(0, c.currentTime);
      out.gain.linearRampToValueAtTime(1, c.currentTime + ROOM_FADE);
      out.connect(master);
      for (const bed of beds) stops.push(bed(c, out));
    };
    rooms.add(wake);
    wake();
    const channel: Dest = () => out;
    return {
      tone: (...args) => {
        wake();
        tone(channel, ...args);
      },
      noise: (...args) => {
        wake();
        noise(channel, ...args);
      },
      bed(bed) {
        if (gone) return;
        beds.push(bed);
        if (out && ctx) stops.push(bed(ctx, out));
        else wake();
      },
      dispose() {
        if (gone) return;
        gone = true;
        rooms.delete(wake);
        const c = ctx;
        const last = out;
        if (!c || !last) return;
        const now = c.currentTime;
        last.gain.cancelScheduledValues(now);
        last.gain.setValueAtTime(last.gain.value, now);
        last.gain.linearRampToValueAtTime(0, now + ROOM_FADE);
        // the fade runs on the audio clock; stopping waits for it on the page's
        setTimeout(() => {
          for (const stop of stops) stop();
          last.disconnect();
        }, ROOM_FADE * 1000);
      },
    };
  }

  const sfx: Pick<RoomSound, "tone" | "noise"> = {
    tone: (...args) => tone(toMaster, ...args),
    noise: (...args) => noise(toMaster, ...args),
  };

  const audio = {
    get muted() {
      return muted;
    },
    setMuted(m: boolean) {
      muted = m;
      storage.setMuted(m);
      if (m && ctx) {
        void ctx.suspend();
      }
      if (!m) {
        ac();
        for (const wake of rooms) wake();
      }
    },
    /** A channel for one room's sounds; dispose it when the room goes. */
    room,
    slide: () => sfx.noise(0.18, 2400, 0.25),
    flip: (delay = 0) => {
      sfx.noise(0.05, 4000, 0.35, delay);
      sfx.tone(900, 0.05, "triangle", 0.08, 600, delay);
    },
    chip: (delay = 0) => {
      sfx.tone(2400 + Math.random() * 500, 0.08, "sine", 0.12, undefined, delay);
      sfx.tone(3600, 0.05, "sine", 0.06, undefined, delay + 0.02);
    },
    /** Someone changed their mind after the reveal and smacked a new card down. */
    slap: () => {
      sfx.noise(0.08, 900, 0.45);
      sfx.tone(180, 0.12, "sine", 0.25, 90);
    },
    bonk: () => {
      sfx.tone(520, 0.25, "sine", 0.35, 140);
      sfx.noise(0.06, 1200, 0.2);
    },
    /** Hand items: a finger jabbed at someone. */
    point: () => {
      sfx.tone(880, 0.05, "triangle", 0.1);
      sfx.tone(1320, 0.07, "triangle", 0.1, undefined, 0.07);
    },
    /** The hammer's arm on its way over, and a thrown paper plane. */
    swing: () => sfx.noise(0.3, 500, 0.22),
    whoosh: () => sfx.noise(0.35, 1400, 0.12),
    /** The toy hammer landing: a thump, and the squeak in and out. */
    squeak: () => {
      sfx.tone(160, 0.14, "sine", 0.3, 70);
      sfx.tone(700, 0.09, "square", 0.12, 1900);
      sfx.tone(1700, 0.16, "square", 0.1, 800, 0.1);
    },
    /** A paper plane bopping a head. */
    tap: () => sfx.noise(0.05, 2600, 0.3),
    hover: () => sfx.tone(1800, 0.03, "sine", 0.03),
    pop: () => sfx.tone(600, 0.1, "triangle", 0.15, 1200),
    /** UI kit: a button or menu item was chosen. */
    confirm: () => {
      sfx.tone(660, 0.07, "triangle", 0.12);
      sfx.tone(990, 0.09, "triangle", 0.1, undefined, 0.05);
    },
    /** UI kit: Esc, or a dialog closed. */
    back: () => sfx.tone(700, 0.1, "triangle", 0.1, 420),
    deal: () => {
      for (let i = 0; i < 5; i++) sfx.noise(0.06, 3000, 0.2, i * 0.07);
    },
    /** The dealer's heads-up that every voter has a card down: a soft two-note ding. */
    chime: () => {
      sfx.tone(1319, 0.45, "sine", 0.16);
      sfx.tone(1760, 0.7, "sine", 0.14, undefined, 0.12);
    },
    win: () => [523, 659, 784, 1046].forEach((f, i) => sfx.tone(f, 0.25, "triangle", 0.15, undefined, i * 0.09)),
  };
  return audio;
}

export type Audio = ReturnType<typeof createAudio>;
