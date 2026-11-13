// The Backlog Basement: a dim basement room with a swaying lamp, a neon sign,
// a telly behind the dealer, a rubber duck and plenty of sticky-note wisdom.
import * as THREE from "three";
import { toon } from "../../scene/art/materials.ts";
import type { Anchor, Vec3 } from "../../scene/layout/layout.ts";
import { FONT, canvasTex, woodTexture, wrapText } from "../../scene/art/textures.ts";
import type { Environment, Sign, Squeaky, StatusScreen } from "../types.ts";
import { feltTexture, wallpaperTexture } from "./textures.ts";

interface Led { mat: THREE.MeshBasicMaterial; rate: number; on: string }

const at = (o: THREE.Object3D, p: Vec3) => o.position.set(p.x, p.y, p.z);

const basement: Environment = {
  async build({ layout, audio, picking }) {
    const { anchors } = layout;
    const root = new THREE.Group();
    root.add(new THREE.HemisphereLight("#6a5a8a", "#1a100c", 2.0));
    root.add(new THREE.AmbientLight("#ffffff", 0.3));
    const leds: Led[] = [];
    buildRoom(root, leds);
    const lamp = hangingLamp(anchors.lamp);
    const sign = neonSign(anchors.sign);
    const statusScreen = telly(anchors.statusScreen);
    const squeaky = rubberDuck(anchors.squeaky, audio.squeak);
    picking.register(squeaky.object, () => squeaky.squeak());
    const dust = dustMotes();
    root.add(lamp.object, sign.object, statusScreen.object, squeaky.object, dust.object);

    return {
      root,
      background: new THREE.Color("#07050a"),
      fog: new THREE.Fog("#07050a", 6, 16),
      tableMaterials: {
        felt: new THREE.MeshStandardMaterial({ map: feltTexture(), roughness: 1 }),
        wood: new THREE.MeshStandardMaterial({ color: "#2a140c", roughness: 0.6 }),
        trim: new THREE.MeshStandardMaterial({ color: "#4a2412", roughness: 0.35, metalness: 0.1 }),
        base: new THREE.MeshStandardMaterial({ color: "#1d0e08", roughness: 0.5 }),
      },
      props: { statusScreen, sign, squeaky },
      ambience: "basement",
      update(dt, t) {
        lamp.update(t);
        sign.update(t);
        for (const l of leds) l.mat.color.set(Math.sin(t * l.rate + l.rate * 10) > 0 ? l.on : "#111");
        statusScreen.update();
        dust.update(dt, t);
        squeaky.update(dt);
      },
      dispose() {
        root.traverse((o) => {
          const m = o as THREE.Mesh;
          m.geometry?.dispose();
          for (const mat of [m.material].flat()) (mat as THREE.Material | undefined)?.dispose();
        });
      },
    };
  },
};
export default basement;

/** A green-shaded lamp over the table, slowly swaying, now and then flickering. */
function hangingLamp(anchor: Anchor) {
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

/** The neon "POINT POKER" sign, buzzing and dropping out now and then. */
function neonSign(anchor: Anchor): Sign & { update(t: number): void } {
  const g = new THREE.Group();
  at(g, anchor.position);
  const tex = canvasTex(1024, 256, (c) => {
    c.textAlign = "center"; c.textBaseline = "middle";
    c.font = `bold 120px ${FONT}`;
    c.shadowColor = "#ff3fa4"; c.shadowBlur = 40;
    c.strokeStyle = "#ff8fd0"; c.lineWidth = 10;
    c.strokeText("POINT POKER", 512, 110);
    c.fillStyle = "#ffe6f5"; c.fillText("POINT POKER", 512, 110);
    c.font = `bold 44px ${FONT}`; c.shadowColor = "#3fd8ff";
    c.fillStyle = "#c8f6ff"; c.fillText("✦ open 'til the sprint ends ✦", 512, 210);
  });
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.65), mat);
  sign.rotation.y = anchor.yaw;
  const light = new THREE.PointLight("#ff3fa4", 3, 6, 1.5);
  light.position.set(-0.45, 0, 0); // just out from the wall
  g.add(sign, light);
  return {
    object: g,
    update(t) {
      const on = Math.sin(t * 0.37) > -0.97 || Math.random() < 0.5;
      mat.opacity = on ? 1 : 0.15;
      light.intensity = on ? 3 : 0.3;
    },
  };
}

/** A CRT telly on a shelf behind the dealer, with scanlines and a bit of flicker. */
function telly(anchor: Anchor): StatusScreen & { update(): void } {
  const g = new THREE.Group();
  at(g, anchor.position);
  const canvas = document.createElement("canvas");
  canvas.width = 512; canvas.height = 384;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const ctx = canvas.getContext("2d")!;
  let lines: [string, string, string] = ["NO TICKET", "waiting on the dealer", ""];
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.55), toon("#5a5048"));
  box.rotation.y = anchor.yaw;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.42), new THREE.MeshBasicMaterial({ map: tex }));
  screen.position.z = 0.28;
  box.add(screen);
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 1.6), woodTexMat());
  shelf.position.set(0.02, -0.3, -0.3);
  const light = new THREE.PointLight("#6fc3ff", 1.5, 3.5, 1.5);
  light.position.set(0.52, 0, 0);
  g.add(box, shelf, light);

  const draw = (flicker = 0) => {
    ctx.fillStyle = "#06121c"; ctx.fillRect(0, 0, 512, 384);
    ctx.fillStyle = "#7fe3ff"; ctx.textAlign = "center";
    ctx.font = `bold 64px ${FONT}`; ctx.fillText(lines[0], 256, 130, 470);
    ctx.font = `34px ${FONT}`;
    wrapText(ctx, lines[1], 460, 3).forEach((l, i) => ctx.fillText(l, 256, 200 + i * 42));
    ctx.fillStyle = "#ffd23f"; ctx.font = `bold 40px ${FONT}`; ctx.fillText(lines[2], 256, 350, 470);
    for (let y = 0; y < 384; y += 4) { ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(0, y, 512, 2); }
    if (flicker) { ctx.fillStyle = `rgba(255,255,255,${flicker})`; ctx.fillRect(0, 0, 512, 384); }
    tex.needsUpdate = true;
  };
  draw();
  return {
    object: g,
    show(title, subtitle, status) { lines = [title, subtitle, status]; draw(); },
    update() { if (Math.random() < 0.02) draw(Math.random() * 0.08); },
  };
}

/** A rubber duck on the felt. Click it. */
function rubberDuck(anchor: Anchor, sound: () => void): Squeaky & { update(dt: number): void } {
  const duck = duckModel();
  at(duck, anchor.position);
  duck.rotation.y = anchor.yaw;
  let hop = 0;
  return {
    object: duck,
    squeak() { sound(); hop = 1; },
    update(dt) {
      if (hop <= 0) return;
      hop = Math.max(0, hop - dt * 2.5);
      duck.position.y = anchor.position.y + Math.sin(hop * Math.PI) * 0.12;
      duck.rotation.y = anchor.yaw + (1 - hop) * Math.PI * 2;
      duck.scale.setScalar(1 + Math.sin(hop * Math.PI) * 0.15);
    },
  };
}

/** Dust motes drifting up through the lamp light. */
function dustMotes() {
  const N = 120;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const r = Math.random() * 1.6, a = Math.random() * Math.PI * 2;
    pos.set([Math.cos(a) * r, 0.9 + Math.random() * 1.2, Math.sin(a) * r], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({ color: "#ffe2b0", size: 0.006, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
  return {
    object: points,
    update(dt: number, t: number) {
      const p = geo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        let y = p.getY(i) + dt * 0.02;
        if (y > 2.2) y = 0.9;
        p.setXYZ(i, p.getX(i) + Math.sin(t * 0.3 + i) * dt * 0.01, y, p.getZ(i) + Math.cos(t * 0.2 + i) * dt * 0.01);
      }
      p.needsUpdate = true;
    },
  };
}

function buildRoom(s: THREE.Group, leds: Led[]) {
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 8), new THREE.MeshStandardMaterial({ map: woodTexture("#2c1b12", "#160c06", 5), roughness: 0.85 }));
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
    [0, -4, 0, 10, 3.4], [0, 4, Math.PI, 10, 3.4], [-5, 0, Math.PI / 2, 8, 3.4], [5, 0, -Math.PI / 2, 8, 3.4],
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
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 10), new THREE.MeshStandardMaterial({ color: "#6b5a4a", metalness: 0.7, roughness: 0.4 }));
    pipe.rotation.z = Math.PI / 2;
    pipe.position.set(0, 3.22, z);
    s.add(pipe);
  }

  // corkboard of sticky-note wisdom
  const notes = ["it's just\na button", "WON'T\nFIX", "estimate:\nvibes", "who\nwrote this", "works on\nmy machine", "5 min\ntask", "blocked by\nlegal", "TODO:\nsleep"];
  const corkTex = canvasTex(768, 512, (g) => {
    g.fillStyle = "#8a6038"; g.fillRect(0, 0, 768, 512);
    for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(40,20,5,${Math.random() * 0.25})`; g.fillRect(Math.random() * 768, Math.random() * 512, 3, 3); }
    g.strokeStyle = "#3a2414"; g.lineWidth = 24; g.strokeRect(0, 0, 768, 512);
    const cols = ["#ffd23f", "#ff9ec7", "#8ce05a", "#4ad6ff"];
    notes.forEach((n, i) => {
      const x = 60 + (i % 4) * 172 + Math.random() * 20, y = 50 + Math.floor(i / 4) * 220 + Math.random() * 20;
      g.save(); g.translate(x + 70, y + 70); g.rotate((Math.random() - 0.5) * 0.3);
      g.fillStyle = "rgba(0,0,0,0.3)"; g.fillRect(-66, -62, 140, 140);
      const color = cols[i % cols.length];
      if (color === undefined) throw new Error("Missing sticky note color");
      g.fillStyle = color; g.fillRect(-70, -70, 140, 140);
      g.fillStyle = "#c0392b"; g.beginPath(); g.arc(0, -58, 8, 0, 7); g.fill();
      g.fillStyle = "#2a1d17"; g.font = `bold 24px "Comic Sans MS", ${FONT}`; g.textAlign = "center";
      n.split("\n").forEach((l, k) => g.fillText(l, 0, -10 + k * 30));
      g.restore();
    });
  });
  const cork = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 1.4), new THREE.MeshStandardMaterial({ map: corkTex, roughness: 1 }));
  cork.position.set(-1.6, 1.8, -3.98);
  s.add(cork);

  // whiteboard
  const wbTex = canvasTex(768, 512, (g) => {
    g.fillStyle = "#e9ece8"; g.fillRect(0, 0, 768, 512);
    g.strokeStyle = "#9aa1a6"; g.lineWidth = 20; g.strokeRect(0, 0, 768, 512);
    g.font = `bold 50px "Comic Sans MS", ${FONT}`; g.fillStyle = "#1f4fbf";
    g.fillText("SPRINT GOALS", 50, 90);
    g.font = `36px "Comic Sans MS", ${FONT}`; g.fillStyle = "#222";
    ["1. ship it", "2. don't say \"should be quick\"", "3. stop pointing in hours", "4. ???"].forEach((l, i) => g.fillText(l, 60, 170 + i * 66));
    g.strokeStyle = "#c0392b"; g.lineWidth = 5;
    g.beginPath(); g.moveTo(56, 222); g.lineTo(680, 222); g.stroke();
    g.fillStyle = "#c0392b"; g.font = `bold 40px "Comic Sans MS", ${FONT}`; g.fillText("velocity ↗ (allegedly)", 330, 470);
  });
  const wb = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.33), new THREE.MeshStandardMaterial({ map: wbTex, roughness: 0.5 }));
  wb.position.set(1.4, 1.75, 3.98);
  wb.rotation.y = Math.PI;
  s.add(wb);

  // server rack with blinkenlights
  const rack = new THREE.Group();
  rack.position.set(4.4, 0, -3.4);
  rack.rotation.y = -Math.PI / 4;
  const cab = new THREE.Mesh(new THREE.BoxGeometry(0.75, 2.0, 0.7), new THREE.MeshStandardMaterial({ color: "#16161b", roughness: 0.6, metalness: 0.4 }));
  cab.position.y = 1.0;
  cab.castShadow = true;
  rack.add(cab);
  for (let u = 0; u < 9; u++) {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.15, 0.02), new THREE.MeshStandardMaterial({ color: "#26262e", roughness: 0.5 }));
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
  const crate = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.6), new THREE.MeshStandardMaterial({ map: woodTexture("#6b4a2a", "#3a2414", 1), roughness: 0.9 }));
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
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.1, 0.06), new THREE.MeshStandardMaterial({ map: woodTexture("#3b2a20", "#20140c", 1), roughness: 0.8 }));
  door.position.set(-3.4, 1.05, 3.97);
  const exit = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.14), new THREE.MeshBasicMaterial({
    map: canvasTex(256, 90, (g) => { g.fillStyle = "#0d3"; g.fillRect(0, 0, 256, 90); g.fillStyle = "#eaffea"; g.font = `bold 60px ${FONT}`; g.textAlign = "center"; g.fillText("EXIT?", 128, 68); }),
  }));
  exit.position.set(-3.4, 2.32, 3.96);
  exit.rotation.y = Math.PI;
  const exitLight = new THREE.PointLight("#22ff66", 0.6, 2, 2);
  exitLight.position.set(-3.4, 2.2, 3.7);
  s.add(door, exit, exitLight);
}

function woodTexMat() {
  return new THREE.MeshStandardMaterial({ map: woodTexture("#4a2e1c", "#24140b", 1), roughness: 0.8 });
}

function duckModel(): THREE.Group {
  const g = new THREE.Group();
  const yellow = toon("#ffd23f");
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), yellow);
  body.scale.set(1.2, 0.85, 1);
  body.position.y = 0.06;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), yellow);
  head.position.set(0.05, 0.13, 0);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.05, 8), toon("#ff8a1c"));
  beak.rotation.z = -Math.PI / 2;
  beak.position.set(0.1, 0.125, 0);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.05, 8), yellow);
  tail.rotation.z = Math.PI / 2.8;
  tail.position.set(-0.085, 0.09, 0);
  g.add(body, head, beak, tail);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 6), new THREE.MeshBasicMaterial({ color: "#111" }));
    eye.position.set(0.08, 0.145, s * 0.025);
    g.add(eye);
  }
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
  return g;
}
