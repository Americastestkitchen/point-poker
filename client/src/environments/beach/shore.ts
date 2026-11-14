// Async Atoll's shore: sand, a lapping sea, a sunset sky, palms, a big beach
// umbrella over the table, two tiki torches, and the sound of waves and gulls.
import * as THREE from "three";
import { toon } from "../../scene/art/materials.ts";
import { cylinder, plane, put, sphere } from "../kit/build.ts";
import { between } from "../kit/random.ts";
import type { EnvCtx } from "../types.ts";
import { glowTexture, sandTexture, skyTexture, stripesTexture } from "./textures.ts";

/** Where the sand meets the sea, out past the sign (metres along x). */
export const SHORE_X = 9;
/** The sunset sits low over the sea, a little off to one side. */
const SUN = new THREE.Vector3(30, 7, -12);

export function shore({ anchors, sound, onFrame }: EnvCtx): THREE.Group {
  const g = new THREE.Group();
  g.add(new THREE.HemisphereLight("#ffd9b8", "#c79a62", 1.5));
  const sun = new THREE.DirectionalLight("#ffc48a", 2.4);
  sun.position.copy(SUN).setLength(18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.0005;
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 40 });
  g.add(sun, sky());

  const sand = plane(120, 120, new THREE.MeshStandardMaterial({ map: sandTexture(), roughness: 1 }));
  sand.rotation.x = -Math.PI / 2;
  sand.receiveShadow = true;
  const wet = put(plane(2.4, 120, toon("#c9a46f")), SHORE_X - 1, 0.004, 0);
  wet.rotation.x = -Math.PI / 2;
  g.add(sand, wet);

  const sea = waves();
  g.add(sea.object);

  for (const [x, z, h, lean] of [
    [-6.8, -4.6, 5.2, 0.35],
    [-7.6, 3.2, 4.6, 0.3],
    [3.2, -6.8, 5.6, 0.25],
    [5.6, 5.8, 4.8, 0.4],
    [-3.2, 6.9, 5, 0.3],
    [7.2, -4.4, 4.2, 0.2],
  ] as const)
    g.add(palm(x, z, h, lean));

  const umbrella = beachUmbrella(anchors.lamp.position);
  g.add(umbrella);
  const torches = [tikiTorch(-3.6, -2.7), tikiTorch(-3.6, 2.7)];
  for (const t of torches) g.add(t.object);

  let gullIn = 6;
  onFrame((dt, t) => {
    sea.update(t);
    for (const torch of torches) torch.update(t);
    umbrella.rotation.y = Math.sin(t * 0.4) * 0.01;
    // now and then, a gull somewhere down the beach
    gullIn -= dt;
    if (gullIn > 0) return;
    gullIn = between(9, 18);
    sound.tone(1900, 0.18, "sawtooth", 0.012, 1250);
    sound.tone(1750, 0.24, "sawtooth", 0.01, 1100, 0.24);
  });
  sound.bed(surf);
  return g;
}

/** The sky: a dome with the sunset painted on, and the sun sinking into the sea. */
function sky(): THREE.Group {
  const g = new THREE.Group();
  const painted = new THREE.MeshBasicMaterial({
    map: skyTexture(),
    side: THREE.BackSide,
    fog: false,
    depthWrite: false,
  });
  const dome = sphere(50, painted, 32, 16);
  dome.renderOrder = -1;
  const glow = new THREE.MeshBasicMaterial({
    map: glowTexture("#fff1c2"),
    transparent: true,
    fog: false,
    depthWrite: false,
  });
  const sun = plane(14, 14, glow);
  sun.position.copy(SUN).setLength(45);
  sun.lookAt(0, SUN.y, 0);
  g.add(dome, sun);
  return g;
}

/** The sea: a faceted sheet that swells and sinks, and a line of foam sliding up and down the sand. */
function waves() {
  const width = 42;
  const geo = new THREE.PlaneGeometry(width, 100, 36, 60);
  geo.rotateX(-Math.PI / 2);
  geo.translate(SHORE_X + width / 2, 0.06, 0);
  const pos = geo.getAttribute("position");
  const rest = Float32Array.from(pos.array);
  const sea = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ color: "#2f9fb0", roughness: 0.25, metalness: 0.15, flatShading: true }),
  );
  sea.receiveShadow = true;
  const foamMat = new THREE.MeshBasicMaterial({ color: "#fffaf0", transparent: true, opacity: 0.7 });
  const foam = plane(0.5, 100, foamMat);
  foam.rotation.x = -Math.PI / 2;
  const object = new THREE.Group();
  object.add(sea, foam);
  return {
    object,
    update(t: number) {
      for (let i = 0; i < pos.count; i++) {
        const x = rest[i * 3] ?? 0;
        const z = rest[i * 3 + 2] ?? 0;
        const calm = Math.min(1, (x - SHORE_X) / 3); // flat where it meets the sand
        pos.setY(i, 0.06 + calm * (Math.sin(x * 0.7 - t * 1.1) * 0.12 + Math.cos(z * 0.45 + t * 0.7) * 0.08));
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();
      const wash = Math.sin(t * 0.6);
      foam.position.set(SHORE_X - 0.4 + wash * 0.5, 0.012, 0);
      foamMat.opacity = 0.35 + 0.35 * (1 - Math.abs(wash));
    },
  };
}

/** A palm tree `h` metres tall, its trunk curving `lean` radians away from the table. */
function palm(x: number, z: number, h: number, lean: number): THREE.Group {
  const g = put(new THREE.Group(), x, 0, z, Math.atan2(-z, x)); // local +x points away from the table
  const bark = toon("#8a6440");
  const segments = 8;
  let top = new THREE.Vector3();
  for (let i = 0; i < segments; i++) {
    const f = i / segments;
    const r = 0.17 - f * 0.07;
    const seg = cylinder(r * 0.92, r, h / segments + 0.02, bark, 8);
    const bend = lean * f * f;
    seg.position.set(Math.sin(bend) * h * f * 0.5, (h / segments) * (i + 0.5), 0);
    seg.rotation.z = -bend;
    seg.castShadow = true;
    g.add(seg);
    top = new THREE.Vector3(seg.position.x, h, 0);
  }
  const leaf = toon("#3f8a3a", { side: THREE.DoubleSide });
  const leafDark = toon("#2f6f2e", { side: THREE.DoubleSide });
  for (let i = 0; i < 8; i++) {
    const frond = new THREE.Mesh(new THREE.ConeGeometry(0.32, 2.4, 4, 1), i % 2 ? leaf : leafDark);
    frond.scale.z = 0.12;
    frond.geometry.translate(0, 1.2, 0);
    frond.position.copy(top);
    frond.rotation.set(0, (i / 8) * Math.PI * 2, 1.15 + (i % 3) * 0.12, "YXZ");
    frond.castShadow = true;
    g.add(frond);
  }
  const nut = toon("#5a3a1e");
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    g.add(put(sphere(0.11, nut, 8, 6), top.x + Math.cos(a) * 0.14, h - 0.18, Math.sin(a) * 0.14));
  }
  return g;
}

/**
 * A big striped umbrella planted between two seats on the far side of the table,
 * leaning in a little and shading that side. It stands off to the dealer's left
 * so it never hides the sign.
 */
function beachUmbrella(over: THREE.Vector3Like): THREE.Group {
  const foot = new THREE.Vector3(over.x + 0.4, 0, over.z - 3.6);
  const top = new THREE.Vector3(over.x + 0.2, over.y + 1, over.z - 2.1);
  const g = new THREE.Group();
  g.position.copy(foot);
  const lean = new THREE.Group();
  const along = top.clone().sub(foot);
  const length = along.length();
  lean.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), along.normalize());
  g.add(lean);
  const pole = put(cylinder(0.035, 0.035, length, toon("#f3ead6"), 8), 0, length / 2, 0);
  pole.castShadow = true;
  const stripes = toon("#ffffff", { map: stripesTexture("#e4573d", "#fff4e0", 16), side: THREE.DoubleSide });
  const canopy = put(new THREE.Mesh(new THREE.ConeGeometry(2.1, 0.65, 16, 1, true), stripes), 0, length - 0.1, 0);
  canopy.castShadow = true;
  lean.add(pole, canopy, put(sphere(0.08, toon("#e4573d"), 8, 6), 0, length + 0.26, 0));
  return g;
}

/** A bamboo tiki torch whose flame dances and lights the sand round it. */
function tikiTorch(x: number, z: number) {
  const g = put(new THREE.Group(), x, 0, z);
  const pole = put(cylinder(0.035, 0.045, 1.7, toon("#b08a4e"), 8), 0, 0.85, 0);
  pole.castShadow = true;
  const cup = put(cylinder(0.1, 0.06, 0.22, toon("#6b4a2a"), 8), 0, 1.78, 0);
  const flameMat = new THREE.MeshBasicMaterial({ color: "#ffb347", transparent: true, opacity: 0.9 });
  const flame = put(new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.3, 8), flameMat), 0, 2.02, 0);
  const light = put(new THREE.PointLight("#ff9a40", 1.6, 5, 1.6), 0, 2.1, 0);
  g.add(pole, cup, flame, light);
  const seed = x * 3.1 + z * 1.7;
  return {
    object: g,
    update(t: number) {
      const f = 0.85 + Math.sin(t * 9 + seed) * 0.08 + Math.sin(t * 23 + seed * 2) * 0.05;
      flame.scale.set(1, f, 1);
      light.intensity = 1.6 * f;
    },
  };
}

/** Rolling surf: looped noise, muffled, swelling in and out like waves breaking. */
function surf(c: AudioContext, out: AudioNode): () => void {
  const length = c.sampleRate * 2;
  const buf = c.createBuffer(1, length, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < length; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const muffle = c.createBiquadFilter();
  muffle.type = "lowpass";
  muffle.frequency.value = 520;
  const swell = c.createGain();
  swell.gain.value = 0.02;
  const lfo = c.createOscillator();
  lfo.frequency.value = 0.11;
  const depth = c.createGain();
  depth.gain.value = 0.016;
  lfo.connect(depth).connect(swell.gain);
  src.connect(muffle).connect(swell).connect(out);
  src.start();
  lfo.start();
  return () => {
    src.stop();
    lfo.stop();
  };
}
