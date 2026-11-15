// Neon for any room's sign: the Point Poker logo, or tubes and words of your own.
import * as THREE from "three";
import { GLASS, GLOW_BLUR, LAYERS, LOGO, NEON, type Tube } from "../../../../shared/brand.ts";
import { FONT, canvasTex } from "../../scene/art/textures.ts";
import type { EnvCtx } from "../types.ts";
import { plane } from "./build.ts";

const PIXELS = 1024; // canvas width

/**
 * The logo's tubes on a plane `width` metres wide, facing +z. `how` says which
 * tubes to draw: lit, as dark glass, or not at all (to light some on a layer of their own).
 */
export function neonLogo(width: number, how: (t: Tube) => "lit" | "glass" | "none") {
  const { box, tubes } = LOGO;
  const px = PIXELS / box.width;
  const tex = canvasTex(PIXELS, Math.round(box.height * px), (c) => {
    for (const t of tubes) {
      const mode = how(t);
      if (mode === "none") continue;
      const path = new Path2D(t.d);
      const k = t.scale * px;
      const place = (dx = 0) => c.setTransform(k, 0, 0, k, (t.x - box.x) * px + dx, (t.y - box.y) * px);
      c.lineCap = "round";
      c.lineJoin = "round";
      if (mode === "glass") {
        place();
        c.lineWidth = t.weight;
        c.strokeStyle = GLASS;
        c.stroke(path);
        continue;
      }
      for (const layer of LAYERS) {
        c.save();
        c.lineWidth = t.weight * layer.width;
        c.globalAlpha = layer.opacity;
        c.strokeStyle = layer.part === "core" ? NEON[t.tone].core : NEON[t.tone].tube;
        if (layer.part === "glow") {
          // Draw the glow off the canvas and keep only its blurred shadow: a soft halo with no hard edge.
          const away = PIXELS * 2;
          place(-away);
          c.shadowOffsetX = away;
          c.shadowColor = NEON[t.tone].tube;
          c.shadowBlur = GLOW_BLUR * k * 2; // shadowBlur is about twice a Gaussian's deviation
        } else place();
        c.stroke(path);
        c.restore();
      }
    }
  });
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const mesh = plane(width, (width * box.height) / box.width, mat);
  return { mesh, mat };
}

/**
 * The whole logo in neon, buzzing, its flickering tubes (the R) dropping out now
 * and then. `onFlicker` hears whether they're lit each frame, to dim a light with them.
 */
export function flickeringNeonLogo(width: number) {
  // The steady tubes (the flickering ones as unlit glass), and the flickering ones lit on a layer of their own.
  const steady = neonLogo(width, (t) => (t.flickers ? "glass" : "lit"));
  const flicker = neonLogo(width, (t) => (t.flickers ? "lit" : "none"));
  flicker.mesh.position.z = 0.002;
  const object = new THREE.Group();
  object.add(steady.mesh, flicker.mesh);
  return {
    object,
    /** Call every frame; true while the flickering tubes are lit. */
    update(t: number): boolean {
      const on = Math.sin(t * 0.37) > -0.97 || Math.random() < 0.5;
      flicker.mat.opacity = on ? 1 : 0;
      return on;
    },
  };
}

/** How loud the buzz drops while the flickering tubes are out: the rest of the sign keeps humming. */
const BUZZ_DARK = 0.2;
/** Seconds the tubes must stay lit before going dark counts as a new burst of flicker, with its own snap. */
const BURST_GAP = 0.4;

/**
 * A neon transformer's buzz in the room: a 120 Hz hum with a bit of crackle, kept low.
 * Call what it returns every frame with whether the flickering tubes are lit (what
 * `flickeringNeonLogo().update` says). While they're out the buzz drops, so a burst of
 * flicker stutters on the same frames as the tube, and each burst starts with one snap.
 */
export function neonBuzz(sound: EnvCtx["sound"], volume = 0.014) {
  let gate: GainNode | null = null;
  let lit = true;
  let litSince = -Infinity;
  sound.bed((c, out) => {
    // the mains twice over, as a transformer hums, with a sawtooth's edge taken off
    const hum = c.createOscillator();
    hum.type = "sawtooth";
    hum.frequency.value = 120;
    const body = c.createBiquadFilter();
    body.type = "lowpass";
    body.frequency.value = 900;
    const humGain = c.createGain();
    humGain.gain.value = volume;
    // the crackle: sparse ticks of noise up high
    const crackle = c.createBufferSource();
    crackle.buffer = crackleBuffer(c, 3.1);
    crackle.loop = true;
    const fizz = c.createBiquadFilter();
    fizz.type = "highpass";
    fizz.frequency.value = 2500;
    const crackleGain = c.createGain();
    crackleGain.gain.value = volume * 0.5;
    const g = c.createGain();
    g.gain.value = lit ? 1 : BUZZ_DARK;
    hum.connect(body).connect(humGain).connect(g);
    crackle.connect(fizz).connect(crackleGain).connect(g);
    g.connect(out);
    hum.start();
    crackle.start();
    gate = g;
    return () => {
      hum.stop();
      crackle.stop();
      gate = null;
    };
  });
  return (on: boolean, t: number) => {
    if (on === lit) return;
    lit = on;
    if (on) litSince = t;
    else if (t - litSince > BURST_GAP) sound.noise(0.06, 3200, 0.05); // the snap as it catches out
    if (gate) gate.gain.setTargetAtTime(on ? 1 : BUZZ_DARK, gate.context.currentTime, 0.004);
  };
}

/** Noise that's mostly silent, ticking now and then: a tube's crackle. */
function crackleBuffer(c: AudioContext, seconds: number) {
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * seconds), c.sampleRate);
  const d = buf.getChannelData(0);
  const fade = Math.exp(-1 / (c.sampleRate * 0.002)); // each tick dies away in a couple of milliseconds
  let env = 0;
  for (let i = 0; i < d.length; i++) {
    if (Math.random() < 30 / c.sampleRate) env = Math.max(env, 0.3 + Math.random() * 0.7);
    d[i] = (Math.random() * 2 - 1) * env;
    env *= fade;
  }
  return buf;
}

/** Strokes whatever `draw` paths or writes as a lit tube: a glow, the tube and its hot core. */
export type Stroke = (draw: () => void) => void;

/**
 * A glowing plane of neon (red unless told otherwise), `width` by `height` metres,
 * facing +z. `draw` strokes paths and text with `tube`; the font is set to fill the
 * plane's height, centred.
 */
export function neonTubes(
  width: number,
  height: number,
  draw: (g: CanvasRenderingContext2D, W: number, H: number, tube: Stroke) => void,
  { color = "#ff4d4d", core = "#ffe0dc" } = {},
) {
  const W = 512,
    H = Math.round((W * height) / width);
  const map = canvasTex(W, H, (g) => {
    g.font = `bold ${Math.round(H * 0.56)}px ${FONT}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.lineJoin = "round";
    g.lineCap = "round";
    const tube: Stroke = (path) => {
      for (const [stroke, lineWidth, blur] of [
        [color, 14, 24],
        [color, 7, 0],
        [core, 2.5, 0],
      ] as const) {
        g.save();
        g.strokeStyle = stroke;
        g.lineWidth = lineWidth;
        g.shadowColor = color;
        g.shadowBlur = blur;
        path();
        g.restore();
      }
    };
    draw(g, W, H, tube);
  });
  const mat = new THREE.MeshBasicMaterial({
    map,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  return { mesh: plane(width, height, mat), mat };
}

/** A word or two in neon, `width` by `height` metres, like "OPEN". */
export const neonText = (text: string, width: number, height: number, colors?: { color?: string; core?: string }) =>
  neonTubes(width, height, (g, W, H, tube) => tube(() => g.strokeText(text, W / 2, H / 2 + 4)), colors);
