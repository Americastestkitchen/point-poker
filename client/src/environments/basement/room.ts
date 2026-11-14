// The Basement's room itself: walls, pipes, the corkboard, the whiteboard, the
// blinking server rack, the sad plant, the door nobody uses, the lamp and the dust.
import * as THREE from "three";
import { toon } from "../../scene/art/materials.ts";
import { FONT, canvasTex, woodTexture } from "../../scene/art/textures.ts";
import type { Anchor } from "../../scene/layout/layout.ts";
import { speckle } from "../kit/canvas.ts";
import { wallpaperTexture } from "./textures.ts";

export interface Led {
  mat: THREE.MeshBasicMaterial;
  rate: number;
  on: string;
}

const at = (o: THREE.Object3D, p: Anchor["position"]) => o.position.set(p.x, p.y, p.z);

/** A green-shaded lamp over the table, slowly swaying, now and then flickering. */
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
  return {
    object: pivot,
    update(t: number) {
      pivot.rotation.z = Math.sin(t * 0.7) * 0.035;
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

export function buildRoom(s: THREE.Group, leds: Led[]) {
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

  // corkboard of sticky-note wisdom
  const notes = [
    "it's just\na button",
    "WON'T\nFIX",
    "estimate:\nvibes",
    "who\nwrote this",
    "works on\nmy machine",
    "5 min\ntask",
    "blocked by\nlegal",
    "TODO:\nsleep",
  ];
  const corkTex = canvasTex(768, 512, (g) => {
    g.fillStyle = "#8a6038";
    g.fillRect(0, 0, 768, 512);
    speckle(g, 4000, 3, () => `rgba(40,20,5,${Math.random() * 0.25})`);
    g.strokeStyle = "#3a2414";
    g.lineWidth = 24;
    g.strokeRect(0, 0, 768, 512);
    const cols = ["#ffd23f", "#ff9ec7", "#8ce05a", "#4ad6ff"];
    notes.forEach((n, i) => {
      const x = 60 + (i % 4) * 172 + Math.random() * 20,
        y = 50 + Math.floor(i / 4) * 220 + Math.random() * 20;
      g.save();
      g.translate(x + 70, y + 70);
      g.rotate((Math.random() - 0.5) * 0.3);
      g.fillStyle = "rgba(0,0,0,0.3)";
      g.fillRect(-66, -62, 140, 140);
      const color = cols[i % cols.length];
      if (color === undefined) throw new Error("Missing sticky note color");
      g.fillStyle = color;
      g.fillRect(-70, -70, 140, 140);
      g.fillStyle = "#c0392b";
      g.beginPath();
      g.arc(0, -58, 8, 0, 7);
      g.fill();
      g.fillStyle = "#2a1d17";
      g.font = `bold 24px "Comic Sans MS", ${FONT}`;
      g.textAlign = "center";
      n.split("\n").forEach((l, k) => g.fillText(l, 0, -10 + k * 30));
      g.restore();
    });
  });
  const cork = new THREE.Mesh(
    new THREE.PlaneGeometry(2.1, 1.4),
    new THREE.MeshStandardMaterial({ map: corkTex, roughness: 1 }),
  );
  cork.position.set(-1.6, 1.8, -3.98);
  s.add(cork);

  // whiteboard
  const wbTex = canvasTex(768, 512, (g) => {
    g.fillStyle = "#e9ece8";
    g.fillRect(0, 0, 768, 512);
    g.strokeStyle = "#9aa1a6";
    g.lineWidth = 20;
    g.strokeRect(0, 0, 768, 512);
    g.font = `bold 50px "Comic Sans MS", ${FONT}`;
    g.fillStyle = "#1f4fbf";
    g.fillText("SPRINT GOALS", 50, 90);
    g.font = `36px "Comic Sans MS", ${FONT}`;
    g.fillStyle = "#222";
    ["1. ship it", '2. don\'t say "should be quick"', "3. stop pointing in hours", "4. ???"].forEach((l, i) =>
      g.fillText(l, 60, 170 + i * 66),
    );
    g.strokeStyle = "#c0392b";
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(56, 222);
    g.lineTo(680, 222);
    g.stroke();
    g.fillStyle = "#c0392b";
    g.font = `bold 40px "Comic Sans MS", ${FONT}`;
    g.fillText("velocity ↗ (allegedly)", 330, 470);
  });
  const wb = new THREE.Mesh(
    new THREE.PlaneGeometry(2.0, 1.33),
    new THREE.MeshStandardMaterial({ map: wbTex, roughness: 0.5 }),
  );
  wb.position.set(1.4, 1.75, 3.98);
  wb.rotation.y = Math.PI;
  s.add(wb);

  // server rack with blinkenlights
  const rack = new THREE.Group();
  rack.position.set(4.4, 0, -3.4);
  rack.rotation.y = -Math.PI / 4;
  const cab = new THREE.Mesh(
    new THREE.BoxGeometry(0.75, 2.0, 0.7),
    new THREE.MeshStandardMaterial({ color: "#16161b", roughness: 0.6, metalness: 0.4 }),
  );
  cab.position.y = 1.0;
  cab.castShadow = true;
  rack.add(cab);
  for (let u = 0; u < 9; u++) {
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.15, 0.02),
      new THREE.MeshStandardMaterial({ color: "#26262e", roughness: 0.5 }),
    );
    slab.position.set(0, 0.25 + u * 0.19, 0.36);
    rack.add(slab);
    for (let l = 0; l < 4; l++) {
      const on = ["#39ff7a", "#ffb02e", "#39c2ff", "#ff4757"][(u + l) % 4];
      if (on === undefined) throw new Error("Missing rack LED color");
      const mat = new THREE.MeshBasicMaterial({ color: on });
      const led = new THREE.Mesh(new THREE.PlaneGeometry(0.018, 0.018), mat);
      led.position.set(0.18 + l * 0.03, 0.25 + u * 0.19, 0.372);
      rack.add(led);
      leds.push({ mat, rate: 0.5 + Math.random() * 6, on });
    }
  }
  const rackLight = new THREE.PointLight("#39ff7a", 0.8, 2.5, 2);
  rackLight.position.set(0, 1.2, 0.6);
  rack.add(rackLight);
  s.add(rack);

  // crate with a sad office plant
  const crate = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.5, 0.6),
    new THREE.MeshStandardMaterial({ map: woodTexture("#6b4a2a", "#3a2414", 1), roughness: 0.9 }),
  );
  crate.position.set(-4.3, 0.25, -3.3);
  crate.castShadow = true;
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.25, 16), toon("#b0603a"));
  pot.position.set(-4.3, 0.62, -3.3);
  s.add(crate, pot);
  for (let i = 0; i < 7; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), toon(i % 2 ? "#3e7a3a" : "#5f8f3a"));
    leaf.scale.set(0.5, 1.6, 0.25);
    const a = (i / 7) * Math.PI * 2;
    leaf.position.set(-4.3 + Math.cos(a) * 0.08, 0.86, -3.3 + Math.sin(a) * 0.08);
    leaf.rotation.set(Math.sin(a) * 0.6 + 0.4, 0, -Math.cos(a) * 0.6);
    s.add(leaf);
  }

  // a door nobody uses
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 2.1, 0.06),
    new THREE.MeshStandardMaterial({ map: woodTexture("#3b2a20", "#20140c", 1), roughness: 0.8 }),
  );
  door.position.set(-3.4, 1.05, 3.97);
  const exit = new THREE.Mesh(
    new THREE.PlaneGeometry(0.4, 0.14),
    new THREE.MeshBasicMaterial({
      map: canvasTex(256, 90, (g) => {
        g.fillStyle = "#0d3";
        g.fillRect(0, 0, 256, 90);
        g.fillStyle = "#eaffea";
        g.font = `bold 60px ${FONT}`;
        g.textAlign = "center";
        g.fillText("EXIT?", 128, 68);
      }),
    }),
  );
  exit.position.set(-3.4, 2.32, 3.96);
  exit.rotation.y = Math.PI;
  const exitLight = new THREE.PointLight("#22ff66", 0.6, 2, 2);
  exitLight.position.set(-3.4, 2.2, 3.7);
  s.add(door, exit, exitLight);
}

export function woodTexMat() {
  return new THREE.MeshStandardMaterial({ map: woodTexture("#4a2e1c", "#24140b", 1), roughness: 0.8 });
}
