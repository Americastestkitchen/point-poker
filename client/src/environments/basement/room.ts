// The Basement's room itself: floor, walls, pipes, the lamp and the dust. The
// things to click on its walls are in eggs.ts.
import * as THREE from "three";
import { toon } from "../../scene/art/materials.ts";
import { woodTexture } from "../../scene/art/textures.ts";
import type { Anchor } from "../../scene/layout/layout.ts";
import { wobble } from "../kit/animate.ts";
import { wallpaperTexture } from "./textures.ts";

const at = (o: THREE.Object3D, p: Anchor["position"]) => o.position.set(p.x, p.y, p.z);

/** A green-shaded lamp over the table, slowly swaying, now and then flickering. `nudge` sets it swinging. */
export function hangingLamp(anchor: Anchor) {
  const pivot = new THREE.Group();
  at(pivot, anchor.position);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.0), toon("#111"));
  cord.position.y = -0.5;
  const shade = new THREE.Mesh(
    new THREE.ConeGeometry(0.42, 0.3, 32, 1, true),
    new THREE.MeshStandardMaterial({ color: "#1f5a3a", side: THREE.DoubleSide, roughness: 0.4, metalness: 0.3 }),
  );
  shade.position.y = -1.1;
  const bulbMat = new THREE.MeshStandardMaterial({ color: "#fff3d0", emissive: "#ffd28a", emissiveIntensity: 4 });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), bulbMat);
  bulb.position.y = -1.2;
  const spot = new THREE.SpotLight("#ffd9a0", 9, 0, 0.85, 0.6, 1.2);
  spot.position.y = -1.2;
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.bias = -0.0005;
  spot.shadow.camera.near = 0.2;
  const target = new THREE.Object3D();
  target.position.y = -3;
  spot.target = target;
  pivot.add(cord, shade, bulb, spot, target);
  const glow = new THREE.PointLight("#ffbf70", 0.5, 3, 2);
  glow.position.y = -1.05;
  pivot.add(glow);
  const swing = wobble(2.6, 0.7);
  return {
    object: pivot,
    nudge: () => swing.kick(0.22),
    update(dt: number, t: number) {
      pivot.rotation.z = Math.sin(t * 0.7) * 0.035 + swing.step(dt);
      pivot.rotation.x = Math.sin(t * 0.53 + 1) * 0.025;
      const flick = Math.random() < 0.004 ? 0.4 : 1;
      bulbMat.emissiveIntensity = 4 * flick;
      spot.intensity = 9 * (flick < 1 ? 0.7 : 1);
    },
  };
}

/** Dust motes drifting up through the lamp light. */
export function dustMotes() {
  const N = 120;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const r = Math.random() * 1.6,
      a = Math.random() * Math.PI * 2;
    pos.set([Math.cos(a) * r, 0.9 + Math.random() * 1.2, Math.sin(a) * r], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  const p = new THREE.BufferAttribute(pos, 3);
  geo.setAttribute("position", p);
  const points = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      color: "#ffe2b0",
      size: 0.006,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  return {
    object: points,
    update(dt: number, t: number) {
      for (let i = 0; i < p.count; i++) {
        let y = p.getY(i) + dt * 0.02;
        if (y > 2.2) y = 0.9;
        p.setXYZ(i, p.getX(i) + Math.sin(t * 0.3 + i) * dt * 0.01, y, p.getZ(i) + Math.cos(t * 0.2 + i) * dt * 0.01);
      }
      p.needsUpdate = true;
    },
  };
}

export function buildRoom(s: THREE.Group) {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 8),
    new THREE.MeshStandardMaterial({ map: woodTexture("#2c1b12", "#160c06", 5), roughness: 0.85 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  s.add(floor);
  const rug = new THREE.Mesh(new THREE.CircleGeometry(1, 48), toon("#24343a"));
  rug.scale.set(3.4, 2.7, 1);
  rug.rotation.x = -Math.PI / 2;
  rug.position.y = 0.005;
  rug.receiveShadow = true;
  s.add(rug);
  const wallMat = new THREE.MeshStandardMaterial({ map: wallpaperTexture(), roughness: 0.95 });
  const walls: [number, number, number, number, number][] = [
    [0, -4, 0, 10, 3.4],
    [0, 4, Math.PI, 10, 3.4],
    [-5, 0, Math.PI / 2, 8, 3.4],
    [5, 0, -Math.PI / 2, 8, 3.4],
  ];
  for (const [x, z, ry, w, h] of walls) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat);
    m.position.set(x, h / 2, z);
    m.rotation.y = ry;
    m.receiveShadow = true;
    s.add(m);
    const base = new THREE.Mesh(new THREE.BoxGeometry(w, 0.14, 0.04), toon("#1b120c"));
    base.position.set(x, 0.07, z);
    base.rotation.y = ry;
    s.add(base);
  }
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(10, 8), toon("#120d14"));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = 3.4;
  s.add(ceil);
  // exposed pipes
  for (const z of [-1.4, 1.6]) {
    const pipe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 10),
      new THREE.MeshStandardMaterial({ color: "#6b5a4a", metalness: 0.7, roughness: 0.4 }),
    );
    pipe.rotation.z = Math.PI / 2;
    pipe.position.set(0, 3.22, z);
    s.add(pipe);
  }
}

export function woodTexMat() {
  return new THREE.MeshStandardMaterial({ map: woodTexture("#4a2e1c", "#24140b", 1), roughness: 0.8 });
}
