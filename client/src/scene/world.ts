// The Backlog Basement: room, table, lamp and props.
import * as THREE from "three";
import { toon } from "../avatar.ts";
import type { Picking } from "./picking.ts";
import { FONT, canvasTex, drawTicket, feltTexture, wallpaperTexture, woodTexture, wrapText } from "./textures.ts";

export const TABLE_Y = 0.8;
const TABLE_RX = 1.95, TABLE_RZ = 1.3;
const SEAT_RX = 2.38, SEAT_RZ = 1.74;

/**
 * Slot -1 is the dealer at the head of the table. Everyone else is spread
 * evenly around the rest of it, so the table re-arranges as people join.
 */
export function seatInfo(slot: number, count: number) {
  const angle = slot < 0 ? Math.PI : Math.PI + ((slot + 1) * 2 * Math.PI) / (Math.max(count, 1) + 1);
  const x = Math.cos(angle) * SEAT_RX;
  const z = Math.sin(angle) * SEAT_RZ;
  const facing = Math.atan2(-x, -z); // rotation.y that points local +z at the table centre
  const toward = (f: number) => new THREE.Vector3(x * f, TABLE_Y, z * f);
  const side = new THREE.Vector3(Math.cos(facing), 0, -Math.sin(facing)); // local +x
  return { x, z, facing, toward, side };
}

export class World {
  private readonly scene: THREE.Scene;
  readonly duck: THREE.Group;
  readonly pot = new THREE.Group();
  private lampPivot = new THREE.Group();
  private bulbMat: THREE.MeshStandardMaterial;
  private spot: THREE.SpotLight;
  private neon: { mat: THREE.MeshBasicMaterial; light: THREE.PointLight };
  private leds: { mat: THREE.MeshBasicMaterial; rate: number; on: string }[] = [];
  private tv: { tex: THREE.CanvasTexture; ctx: CanvasRenderingContext2D; lines: [string, string, string] };
  private ticketPaper: THREE.Mesh;
  private ticketCtx: CanvasRenderingContext2D;
  private ticketTex: THREE.CanvasTexture;
  private dust: THREE.Points;
  private duckHop = 0;

  constructor(scene: THREE.Scene, picking: Picking, hooks: { onTicket(): void; onSqueak(): void }) {
    this.scene = scene;
    const s = this.scene;
    s.background = new THREE.Color("#07050a");
    s.fog = new THREE.Fog("#07050a", 6, 16);

    s.add(new THREE.HemisphereLight("#6a5a8a", "#1a100c", 2.0));
    s.add(new THREE.AmbientLight("#ffffff", 0.3));

    this.buildRoom();
    this.buildTable();

    // hanging lamp, slowly swaying
    this.lampPivot.position.set(0, 3.2, 0);
    s.add(this.lampPivot);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.0), toon("#111"));
    cord.position.y = -0.5;
    const shade = new THREE.Mesh(
      new THREE.ConeGeometry(0.42, 0.3, 32, 1, true),
      new THREE.MeshStandardMaterial({ color: "#1f5a3a", side: THREE.DoubleSide, roughness: 0.4, metalness: 0.3 }),
    );
    shade.position.y = -1.1;
    this.bulbMat = new THREE.MeshStandardMaterial({ color: "#fff3d0", emissive: "#ffd28a", emissiveIntensity: 4 });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), this.bulbMat);
    bulb.position.y = -1.2;
    this.spot = new THREE.SpotLight("#ffd9a0", 9, 0, 0.85, 0.6, 1.2);
    this.spot.position.y = -1.2;
    this.spot.castShadow = true;
    this.spot.shadow.mapSize.set(1024, 1024);
    this.spot.shadow.bias = -0.0005;
    this.spot.shadow.camera.near = 0.2;
    const target = new THREE.Object3D();
    target.position.y = -3;
    this.spot.target = target;
    this.lampPivot.add(cord, shade, bulb, this.spot, target);
    const glow = new THREE.PointLight("#ffbf70", 0.5, 3, 2);
    glow.position.y = -1.05;
    this.lampPivot.add(glow);

    // neon sign, behind the far end of the table (facing the dealer)
    const neonTex = canvasTex(1024, 256, (g) => {
      g.textAlign = "center"; g.textBaseline = "middle";
      g.font = `bold 120px ${FONT}`;
      g.shadowColor = "#ff3fa4"; g.shadowBlur = 40;
      g.strokeStyle = "#ff8fd0"; g.lineWidth = 10;
      g.strokeText("POINT POKER", 512, 110);
      g.fillStyle = "#ffe6f5"; g.fillText("POINT POKER", 512, 110);
      g.font = `bold 44px ${FONT}`; g.shadowColor = "#3fd8ff";
      g.fillStyle = "#c8f6ff"; g.fillText("✦ open 'til the sprint ends ✦", 512, 210);
    });
    const neonMat = new THREE.MeshBasicMaterial({ map: neonTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const neonSign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.65), neonMat);
    neonSign.position.set(4.95, 2.2, 0);
    neonSign.rotation.y = -Math.PI / 2;
    const neonLight = new THREE.PointLight("#ff3fa4", 3, 6, 1.5);
    neonLight.position.set(4.5, 2.2, 0);
    s.add(neonSign, neonLight);
    this.neon = { mat: neonMat, light: neonLight };

    // CRT telly behind the dealer
    const tvCanvas = document.createElement("canvas");
    tvCanvas.width = 512; tvCanvas.height = 384;
    const tvTex = new THREE.CanvasTexture(tvCanvas);
    tvTex.colorSpace = THREE.SRGBColorSpace;
    this.tv = { tex: tvTex, ctx: tvCanvas.getContext("2d")!, lines: ["NO TICKET", "waiting on the dealer", ""] };
    const tvBox = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.55), toon("#5a5048"));
    tvBox.position.set(-4.62, 1.95, 0.9);
    tvBox.rotation.y = Math.PI / 2 + 0.25;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.42), new THREE.MeshBasicMaterial({ map: tvTex }));
    screen.position.z = 0.28;
    tvBox.add(screen);
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 1.6), woodTexMat());
    shelf.position.set(-4.6, 1.65, 0.6);
    const tvLight = new THREE.PointLight("#6fc3ff", 1.5, 3.5, 1.5);
    tvLight.position.set(-4.1, 1.95, 0.9);
    s.add(tvBox, shelf, tvLight);
    this.drawTv();

    // the ticket, as a sheet of paper in the middle of the felt
    const tc = document.createElement("canvas");
    tc.width = 512; tc.height = 380;
    this.ticketCtx = tc.getContext("2d")!;
    this.ticketTex = new THREE.CanvasTexture(tc);
    this.ticketTex.colorSpace = THREE.SRGBColorSpace;
    this.ticketTex.anisotropy = 8;
    this.ticketPaper = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.52), new THREE.MeshStandardMaterial({ map: this.ticketTex, roughness: 1, color: "#b8ab95" }));
    this.ticketPaper.rotation.x = -Math.PI / 2;
    this.ticketPaper.rotation.z = Math.PI / 2; // readable from the dealer's side… and upside down for half the table, as is tradition
    this.ticketPaper.position.set(-0.15, TABLE_Y + 0.003, 0);
    this.ticketPaper.receiveShadow = true;
    picking.register(this.ticketPaper, hooks.onTicket);
    s.add(this.ticketPaper);
    this.setTicket(null);

    this.pot.position.set(0.55, TABLE_Y, 0);
    s.add(this.pot);

    this.duck = buildDuck();
    this.duck.position.set(0.3, TABLE_Y, 0.42);
    this.duck.rotation.y = -0.8;
    picking.register(this.duck, () => { hooks.onSqueak(); this.duckHop = 1; });
    s.add(this.duck);

    // dust motes in the lamp light
    const N = 120;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const r = Math.random() * 1.6, a = Math.random() * Math.PI * 2;
      pos.set([Math.cos(a) * r, 0.9 + Math.random() * 1.2, Math.sin(a) * r], i * 3);
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this.dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: "#ffe2b0", size: 0.006, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.add(this.dust);
  }

  private buildRoom() {
    const s = this.scene;
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
        g.fillStyle = cols[i % 4]; g.fillRect(-70, -70, 140, 140);
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
        const mat = new THREE.MeshBasicMaterial({ color: on });
        const led = new THREE.Mesh(new THREE.PlaneGeometry(0.018, 0.018), mat);
        led.position.set(0.18 + l * 0.03, 0.25 + u * 0.19, 0.372);
        rack.add(led);
        this.leds.push({ mat, rate: 0.5 + Math.random() * 6, on });
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

  private buildTable() {
    const s = this.scene;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.06, 64), [
      new THREE.MeshStandardMaterial({ color: "#2a140c", roughness: 0.6 }),
      new THREE.MeshStandardMaterial({ map: feltTexture(), roughness: 1 }),
      new THREE.MeshStandardMaterial({ color: "#2a140c" }),
    ]);
    top.scale.set(TABLE_RX, 1, TABLE_RZ);
    top.position.y = TABLE_Y - 0.03;
    top.receiveShadow = true;
    s.add(top);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 12, 96), new THREE.MeshStandardMaterial({ color: "#4a2412", roughness: 0.35, metalness: 0.1 }));
    rim.rotation.x = Math.PI / 2;
    rim.scale.set(TABLE_RX + 0.03, TABLE_RZ + 0.03, 1);
    rim.position.y = TABLE_Y;
    rim.castShadow = rim.receiveShadow = true;
    s.add(rim);
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.96, 0.16, 64), new THREE.MeshStandardMaterial({ color: "#2a140c", roughness: 0.6 }));
    skirt.scale.set(TABLE_RX, 1, TABLE_RZ);
    skirt.position.y = TABLE_Y - 0.12;
    s.add(skirt);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.5, 0.7, 24), new THREE.MeshStandardMaterial({ color: "#1d0e08", roughness: 0.5 }));
    leg.position.y = 0.35;
    leg.castShadow = true;
    s.add(leg);
  }

  setTicket(t: { key: string; type: string; summary: string; points: string } | null) {
    if (t) drawTicket(this.ticketCtx, t.key, t.type, t.summary, t.points);
    else {
      const g = this.ticketCtx;
      g.fillStyle = "#efe4c8"; g.fillRect(0, 0, 512, 380);
      g.fillStyle = "#7a5a40"; g.font = `bold 40px ${FONT}`; g.textAlign = "center";
      g.fillText("(no ticket yet)", 256, 200); g.textAlign = "left";
    }
    this.ticketTex.needsUpdate = true;
  }

  setTv(a: string, b: string, c = "") {
    this.tv.lines = [a, b, c];
    this.drawTv();
  }

  private drawTv(flicker = 0) {
    const g = this.tv.ctx;
    g.fillStyle = "#06121c"; g.fillRect(0, 0, 512, 384);
    g.fillStyle = "#7fe3ff"; g.textAlign = "center";
    g.font = `bold 64px ${FONT}`; g.fillText(this.tv.lines[0], 256, 130, 470);
    g.font = `34px ${FONT}`;
    wrapText(g, this.tv.lines[1], 460, 3).forEach((l, i) => g.fillText(l, 256, 200 + i * 42));
    g.fillStyle = "#ffd23f"; g.font = `bold 40px ${FONT}`; g.fillText(this.tv.lines[2], 256, 350, 470);
    for (let y = 0; y < 384; y += 4) { g.fillStyle = "rgba(0,0,0,0.35)"; g.fillRect(0, y, 512, 2); }
    if (flicker) { g.fillStyle = `rgba(255,255,255,${flicker})`; g.fillRect(0, 0, 512, 384); }
    this.tv.tex.needsUpdate = true;
  }

  update(dt: number, t: number) {
    this.lampPivot.rotation.z = Math.sin(t * 0.7) * 0.035;
    this.lampPivot.rotation.x = Math.sin(t * 0.53 + 1) * 0.025;
    const flick = Math.random() < 0.004 ? 0.4 : 1;
    this.bulbMat.emissiveIntensity = 4 * flick;
    this.spot.intensity = 9 * (flick < 1 ? 0.7 : 1);
    const neonOn = Math.sin(t * 0.37) > -0.97 || Math.random() < 0.5;
    this.neon.mat.opacity = neonOn ? 1 : 0.15;
    this.neon.light.intensity = neonOn ? 3 : 0.3;
    for (const l of this.leds) l.mat.color.set(Math.sin(t * l.rate + l.rate * 10) > 0 ? l.on : "#111");
    if (Math.random() < 0.02) this.drawTv(Math.random() * 0.08);
    const p = this.dust.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      let y = p.getY(i) + dt * 0.02;
      if (y > 2.2) y = 0.9;
      p.setXYZ(i, p.getX(i) + Math.sin(t * 0.3 + i) * dt * 0.01, y, p.getZ(i) + Math.cos(t * 0.2 + i) * dt * 0.01);
    }
    p.needsUpdate = true;
    if (this.duckHop > 0) {
      this.duckHop = Math.max(0, this.duckHop - dt * 2.5);
      this.duck.position.y = TABLE_Y + Math.sin(this.duckHop * Math.PI) * 0.12;
      this.duck.rotation.y = -0.8 + (1 - this.duckHop) * Math.PI * 2;
      this.duck.scale.setScalar(1 + Math.sin(this.duckHop * Math.PI) * 0.15);
    }
  }
}

function woodTexMat() {
  return new THREE.MeshStandardMaterial({ map: woodTexture("#4a2e1c", "#24140b", 1), roughness: 0.8 });
}

function buildDuck(): THREE.Group {
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
