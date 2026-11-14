// Standup Station's platform itself: tiled walls, the platform with its yellow
// line, the tracks in their trench, the tunnel mouths, pillars, benches, notices
// and the buzzing strip lights. Everything here stays put; what moves is in eggs.ts.
import * as THREE from "three";
import { toon } from "../../scene/art/materials.ts";
import { FONT, canvasTex } from "../../scene/art/textures.ts";
import type { EnvCtx } from "../types.ts";
import { blinker } from "../kit/animate.ts";
import { box, cylinder, plane, put } from "../kit/build.ts";
import { concreteTexture, edgeLineTexture, posterTexture, tileTexture, tileUv } from "./textures.ts";

/** The room's shape, in metres. The table is at the origin; the tracks run along z past its far end. */
export const ROOM = {
  /** The wall behind the dealer. */
  back: -5,
  /** The wall across the tracks, where the sign is. */
  far: 5,
  /** The side walls, at ±side. */
  side: 4,
  ceiling: 3.4,
  /** Where the platform stops and the trench starts. */
  edge: 3.5,
  /** The trench floor. */
  trench: -1.1,
  /** The middle of the tracks. */
  track: 4.25,
} as const;

/** A flat plaque with text on it, facing +z. */
export function plaque(
  width: number,
  height: number,
  draw: (g: CanvasRenderingContext2D, w: number, h: number) => void,
  px = 512,
) {
  const h = Math.round((px * height) / width);
  return plane(width, height, toon("#ffffff", { map: canvasTex(px, h, (g) => draw(g, px, h)) }));
}

/** The station's name, cream letters on a green-tiled board. */
function nameBoard(g: CanvasRenderingContext2D, w: number, h: number) {
  g.fillStyle = "#c79a3a";
  g.fillRect(0, 0, w, h);
  g.fillStyle = "#1f5c4a";
  g.fillRect(10, 10, w - 20, h - 20);
  g.fillStyle = "#237061";
  for (let y = 12; y < h - 12; y += 10) for (let x = 12; x < w - 12; x += 10) g.fillRect(x, y, 8, 8);
  g.fillStyle = "#f4ecd2";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = `900 ${Math.round(h * 0.5)}px ${FONT}`;
  g.fillText("STANDUP STATION", w / 2, h * 0.54, w - 50);
}

/** Builds the platform into `s`; returns the yellow line, which the gap's easter egg lights up. */
export function buildPlatform(s: THREE.Group) {
  const { back, far, side, ceiling, edge, trench, track } = ROOM;
  const tile = toon("#ffffff", { map: tileTexture() });
  const length = side * 2;

  // the platform
  const platformWidth = edge - back;
  const floor = new THREE.Mesh(
    tileUv(new THREE.PlaneGeometry(platformWidth, length), platformWidth, length, 2),
    new THREE.MeshStandardMaterial({ map: concreteTexture(), roughness: 0.9 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.x = back + platformWidth / 2;
  floor.receiveShadow = true;
  s.add(floor);
  // the yellow line, reading along the platform for someone looking at the tracks
  const line = plane(
    length,
    0.5,
    toon("#ffffff", { map: edgeLineTexture(length), emissive: "#ffcc00", emissiveIntensity: 0 }),
  );
  line.rotation.x = -Math.PI / 2;
  line.receiveShadow = true;
  const lineTurn = put(new THREE.Group(), edge - 0.31, 0.004, 0, -Math.PI / 2);
  lineTurn.add(line);
  s.add(lineTurn);
  const coping = put(box(0.1, 0.04, length, toon("#d8d3c6")), edge - 0.05, 0.01, 0);
  s.add(coping);

  // the trench and the tracks
  const grime = toon("#3a3530");
  s.add(put(plane(length, -trench, grime), edge, trench / 2, 0, Math.PI / 2));
  const ballast = put(plane(far - edge, length, toon("#2b2622")), (far + edge) / 2, trench, 0);
  ballast.rotation.x = -Math.PI / 2;
  s.add(ballast);
  const sleepers = new THREE.InstancedMesh(new THREE.BoxGeometry(1.3, 0.08, 0.22), toon("#4a3d33"), 14);
  const m = new THREE.Matrix4();
  for (let i = 0; i < 14; i++) sleepers.setMatrixAt(i, m.makeTranslation(track, trench + 0.04, -3.9 + i * 0.6));
  s.add(sleepers);
  const steel = new THREE.MeshStandardMaterial({ color: "#9aa0a6", metalness: 0.8, roughness: 0.35 });
  for (const dx of [-0.3, 0.3]) s.add(put(box(0.06, 0.1, length, steel), track + dx, trench + 0.13, 0));

  // walls: behind the dealer, across the tracks (down into the trench), and the two sides
  const wall = (w: number, h: number) => new THREE.Mesh(tileUv(new THREE.PlaneGeometry(w, h), w, h), tile);
  s.add(put(wall(length, ceiling), back, ceiling / 2, 0, Math.PI / 2));
  const farHeight = ceiling - trench;
  s.add(put(wall(length, farHeight), far, trench + farHeight / 2, 0, -Math.PI / 2));
  s.add(put(plane(length, 1.3, grime), far - 0.01, trench + 0.65, 0, -Math.PI / 2));
  for (const z of [-side, side]) {
    const facing = z < 0 ? 0 : Math.PI;
    s.add(put(wall(platformWidth, ceiling), back + platformWidth / 2, ceiling / 2, z, facing));
    s.add(put(tunnelMouth(tile), track, 0, z, facing));
    // the dark beyond the tunnel mouth
    const tunnel = box(1.5, 3, 10, toon("#050505", { side: THREE.BackSide }));
    s.add(put(tunnel, track, trench + 1.5, z + Math.sign(z) * 5));
  }
  // the green and gold bands every station has
  const green = toon("#237061");
  const gold = toon("#c79a3a");
  const bands: [number, number, number, number][] = [
    [back + 0.02, 0, length, Math.PI / 2],
    [far - 0.02, 0, length, -Math.PI / 2],
    [0, -side + 0.02, far - back, 0],
    [0, side - 0.02, far - back, Math.PI],
  ];
  for (const [x, z, w, ry] of bands) {
    s.add(put(plane(w, 0.22, green), x, 2.85, z, ry));
    s.add(put(plane(w, 0.05, gold), x, 2.68, z, ry));
  }

  const ceil = put(plane(far - back, length, toon("#2c3230")), 0, ceiling, 0);
  ceil.rotation.x = Math.PI / 2;
  s.add(ceil);

  // steel pillars along the platform
  const paint = toon("#2f5e50");
  const cream = toon("#e9e2cc");
  for (const x of [-2.9, 0.3]) {
    for (const z of [-3.1, 3.1]) {
      s.add(put(box(0.26, ceiling, 0.26, paint), x, ceiling / 2, z));
      s.add(put(box(0.34, 0.3, 0.34, paint), x, 0.15, z));
      s.add(put(box(0.28, 0.12, 0.28, cream), x, 1.9, z));
    }
  }

  // benches against the side walls
  const wood = toon("#8a5a32");
  for (const z of [-3.62, 3.62]) {
    const bench = put(new THREE.Group(), -1.3, 0, z, z < 0 ? 0 : Math.PI);
    for (let i = 0; i < 3; i++) bench.add(put(box(1.6, 0.04, 0.1, wood), 0, 0.46, -0.12 + i * 0.12));
    for (let i = 0; i < 2; i++) bench.add(put(box(1.6, 0.1, 0.04, wood), 0, 0.62 + i * 0.14, -0.2));
    for (const x of [-0.7, 0.7]) bench.add(put(box(0.06, 0.46, 0.36, paint), x, 0.23, -0.04));
    s.add(bench);
  }

  // the station's name, on the wall behind the dealer and both side walls
  const name = () => plaque(1.9, 0.42, nameBoard);
  s.add(put(name(), back + 0.02, 2.2, -1.9, Math.PI / 2));
  s.add(put(name(), -2.6, 2.2, -side + 0.02, 0));
  s.add(put(name(), -2.6, 2.2, side - 0.02, Math.PI));
  // way out (for those who dare leave a standup)
  const wayOut = plaque(1.0, 0.3, (g, w, h) => {
    g.fillStyle = "#1a1a1a";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#ffd34d";
    g.font = `900 ${Math.round(h * 0.58)}px ${FONT}`;
    g.textBaseline = "middle";
    g.fillText("WAY OUT  →", 24, h * 0.55);
  });
  s.add(put(wayOut, back + 0.02, 2.3, 2.6, Math.PI / 2));
  // adverts
  const poster = (header: string, color: string, lines: string[]) =>
    plane(0.75, 1.0, toon("#ffffff", { map: posterTexture(header, color, lines) }));
  s.add(
    put(poster("BURNDOWN", "#e8434f", ["feel the burn.", "", "now with", "extra scope!"]), 1.4, 1.5, -side + 0.02, 0),
  );
  s.add(
    put(
      poster("VELOCITY", "#2b6fd6", ["now 20% vaguer.", "", "ask your PM if", "velocity is right", "for you."]),
      1.4,
      1.5,
      side - 0.02,
      Math.PI,
    ),
  );
  s.add(
    put(
      poster("RETRO", "#2f8c4a", ["tonight only:", "what went well", "(a short film)"]),
      back + 0.02,
      1.4,
      -3.1,
      Math.PI / 2,
    ),
  );
  return { edgeLine: line };
}

/** A side wall's piece over the trench, with an arched hole the train comes out of. Faces +z. */
function tunnelMouth(tile: THREE.Material) {
  const { trench, ceiling, far, edge } = ROOM;
  const half = (far - edge) / 2;
  const shape = new THREE.Shape()
    .moveTo(-half, trench)
    .lineTo(half, trench)
    .lineTo(half, ceiling)
    .lineTo(-half, ceiling)
    .closePath();
  const r = half - 0.1;
  const spring = 1.1;
  const hole = new THREE.Path()
    .moveTo(-r, trench)
    .lineTo(r, trench)
    .lineTo(r, spring)
    .absarc(0, spring, r, 0, Math.PI, false)
    .lineTo(-r, trench);
  shape.holes.push(hole);
  const mouth = new THREE.Group();
  mouth.add(new THREE.Mesh(tileUv(new THREE.ShapeGeometry(shape, 12), 1, 1), tile));
  // a dark ring round the arch
  mouth.add(put(new THREE.Mesh(new THREE.TorusGeometry(r, 0.05, 6, 16, Math.PI), toon("#1f5c4a")), 0, spring, 0.02));
  return mouth;
}

/**
 * The buzzing strip light over the table, hanging from the lamp's anchor. It
 * flickers now and then, with a tink, the way they do.
 */
export function stripLight(anchor: EnvCtx["anchors"]["lamp"], { sound }: EnvCtx) {
  const { x, z } = anchor.position;
  const top = ROOM.ceiling;
  const y = 2.62;
  const group = new THREE.Group();
  const metal = toon("#5d6468");
  for (const dx of [-0.8, 0.8]) group.add(put(cylinder(0.008, 0.008, top - y, toon("#222")), x + dx, (top + y) / 2, z));
  group.add(put(box(2.2, 0.06, 0.3, metal), x, y + 0.03, z));
  const tubeMat = new THREE.MeshBasicMaterial({ color: "#effffb" });
  for (const dz of [-0.07, 0.07]) {
    const tube = put(cylinder(0.026, 0.026, 2.0, tubeMat, 10), x, y - 0.03, z + dz);
    tube.rotation.z = Math.PI / 2;
    group.add(tube);
  }
  const spot = put(new THREE.SpotLight("#e6fff4", 11, 0, 1.1, 0.75, 1.1), x, y - 0.1, z);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.bias = -0.0005;
  spot.shadow.camera.near = 0.2;
  const target = put(new THREE.Object3D(), x, 0, z);
  spot.target = target;
  const glow = put(new THREE.PointLight("#d8fff0", 1.2, 5, 1.6), x, y - 0.2, z);
  group.add(spot, target, glow);

  const blink = blinker({
    first: [8, 28],
    every: [15, 45],
    length: [0.5, 1.2],
    onBurst: () => sound.tone(120, 0.4, "sawtooth", 0.008),
    onRelight: () => sound.noise(0.02, 5000, 0.012),
  });
  return {
    object: group,
    update(dt: number) {
      const lit = blink.step(dt);
      tubeMat.color.set(lit ? "#effffb" : "#7b8a86");
      spot.intensity = lit ? 11 : 4;
      glow.intensity = lit ? 1.2 : 0.2;
    },
  };
}

/** Strip lights along the ceiling over the platform; just glow, no light. One of them is on the blink. */
export function ceilingLights() {
  const group = new THREE.Group();
  const on = new THREE.MeshBasicMaterial({ color: "#e6fff4" });
  const blinky = new THREE.MeshBasicMaterial({ color: "#e6fff4" });
  const housing = toon("#5d6468");
  const spots: [number, number][] = [
    [-3.6, -2.4],
    [-3.6, 2.4],
    [-0.9, -2.4],
    [-0.9, 2.4],
    [1.9, -2.4],
    [1.9, 2.4],
  ];
  spots.forEach(([x, z], i) => {
    group.add(put(box(0.2, 0.05, 1.3, housing), x, ROOM.ceiling - 0.03, z));
    group.add(put(box(0.08, 0.03, 1.2, i === 4 ? blinky : on), x, ROOM.ceiling - 0.07, z));
  });
  return {
    object: group,
    update(t: number) {
      const off = Math.sin(t * 0.9) > 0.6 && Math.random() < 0.4;
      blinky.color.set(off ? "#5a6662" : "#e6fff4");
    },
  };
}
