// The Backlog Basement: room, table, lamp, props, cards and chips.
import * as THREE from "three";
import { toon } from "./avatar.ts";
import { FONT, canvasTex, cardBack, cardFront, drawTicket, feltTexture, wallpaperTexture, woodTexture, wrapText } from "./textures.ts";

export const TABLE_Y = 0.8;
const TABLE_RX = 1.95, TABLE_RZ = 1.3;
const SEAT_RX = 2.38, SEAT_RZ = 1.74;
export const CARD_W = 0.16, CARD_H = 0.23;

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

export function makeCard(value: number | null): THREE.Group {
  const g = new THREE.Group();
  const geo = new THREE.PlaneGeometry(CARD_W, CARD_H);
  const front = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: value === null ? cardBack() : cardFront(value), roughness: 0.55 }));
  front.name = "front";
  const back = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: cardBack(), roughness: 0.55 }));
  back.rotation.y = Math.PI;
  front.castShadow = back.castShadow = true;
  g.add(front, back);
  return g;
}

export function setCardValue(card: THREE.Group, value: number | null) {
  const front = card.getObjectByName("front") as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  front.material.map = value === null ? cardBack() : cardFront(value);
  front.material.needsUpdate = true;
}

/** A face-down/face-up card sitting on the felt in front of a seat. */
export class TableCard {
  readonly group = new THREE.Group();
  readonly card: THREE.Group;
  private flip = 0; // 0 face down, 1 face up
  private flipTarget = 0;
  private arrive = 1; // 0..1 slide-in progress
  private from = new THREE.Vector3();
  private home = new THREE.Vector3();
  /** Once flipped, a big copy of the card floats up so the whole table can read it. */
  private float = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false, transparent: true }));
  private floatT = 0;
  private base = new THREE.Vector3();
  value: number | null = null;
  noFloat = false;
  /** Seconds before a placed card leaves the hand. */
  private wait = 0;
  private fromFn: (() => THREE.Vector3) | null = null;
  /** Hand-placed cards drift in low and flat; tossed ones arc and spin. */
  private gentle = false;
  private yaw = 0;
  /** How crooked the card sits; adjusting squares it back up. */
  private skew = 0;
  private skewTarget = 0;
  private shift = new THREE.Vector3();
  private shiftTarget = new THREE.Vector3();
  private wiggle = 0;
  private nudgeIn = -1;

  constructor(scene: THREE.Scene) {
    this.card = makeCard(null);
    this.card.scale.setScalar(1.5);
    this.group.add(this.card);
    this.float.renderOrder = 9;
    this.float.visible = false;
    scene.add(this.float);
    this.group.visible = false;
    scene.add(this.group);
  }

  show(value: number | null, fromWorld?: THREE.Vector3 | (() => THREE.Vector3), opts: { delay?: number; gentle?: boolean } = {}) {
    if (!this.group.visible) {
      this.wait = 0; this.fromFn = null; this.gentle = !!opts.gentle;
      if (typeof fromWorld === "function") { this.fromFn = fromWorld; this.wait = opts.delay ?? 0; this.from.copy(this.home); this.arrive = 0; }
      else if (fromWorld) { this.from.copy(fromWorld); this.arrive = 0; }
      else { this.base.copy(this.home); this.arrive = 1; }
      // land a little crooked, like a real person dropping a card
      this.skew = this.skewTarget = (Math.random() - 0.5) * 0.5;
      this.shift.set((Math.random() - 0.5) * 0.06, 0, (Math.random() - 0.5) * 0.05);
      this.shiftTarget.copy(this.shift);
    }
    this.group.visible = true;
    if (value !== this.value) {
      this.value = value;
      setCardValue(this.card, value);
    }
  }

  placeAt(slot: number, count: number, reach = 0.62) {
    const s = seatInfo(slot, count);
    this.home.copy(s.toward(reach)).y += 0.004;
    this.yaw = s.facing + Math.PI;
  }

  /** Someone fiddles with the card: it wiggles and ends up (mostly) straight. */
  nudge(delay = 0) { this.nudgeIn = delay; }

  hide() { this.wait = 0; this.fromFn = null; this.nudgeIn = -1; this.group.visible = false; this.flip = this.flipTarget = 0; this.float.visible = false; this.floatT = 0; }
  faceUp(up: boolean) { this.flipTarget = up ? 1 : 0; }
  get isFaceUp() { return this.flipTarget === 1; }

  update(dt: number) {
    if (!this.group.visible) return;
    if (this.wait > 0) {
      // still in someone's hand
      this.wait -= dt;
      this.card.visible = false;
      if (this.wait > 0) return;
      if (this.fromFn) this.from.copy(this.fromFn());
    }
    this.card.visible = true;
    if (this.nudgeIn >= 0) {
      this.nudgeIn -= dt;
      if (this.nudgeIn < 0) {
        this.wiggle = 1;
        this.skewTarget = (Math.random() - 0.5) * 0.08;
        this.shiftTarget.set((Math.random() - 0.5) * 0.015, 0, (Math.random() - 0.5) * 0.015);
      }
    }
    if (this.wiggle > 0) {
      this.wiggle = Math.max(0, this.wiggle - dt * 1.3);
      const k = Math.min(1, dt * 5);
      this.skew += (this.skewTarget - this.skew) * k;
      this.shift.lerp(this.shiftTarget, k);
    }
    if (this.flip > 0.98 && this.value !== null && !this.noFloat) {
      if (!this.float.visible) {
        this.float.material.map = cardFront(this.value);
        this.float.material.needsUpdate = true;
        this.float.visible = true;
      }
      this.floatT = Math.min(1, this.floatT + dt * 3);
      const k = 1 - Math.pow(1 - this.floatT, 3);
      this.float.position.copy(this.home).y += 0.12 + k * 0.2;
      this.float.scale.set(0.2 * k, 0.29 * k, 1);
    } else if (this.flipTarget === 0) {
      this.float.visible = false;
      this.floatT = 0;
    }
    const speed = 2.6;
    this.flip += Math.sign(this.flipTarget - this.flip) * Math.min(Math.abs(this.flipTarget - this.flip), dt * speed);
    if (this.arrive < 1) this.arrive = Math.min(1, this.arrive + dt * 2.4);
    const e = 1 - Math.pow(1 - this.arrive, 3);
    if (this.arrive < 1) this.base.lerpVectors(this.from, this.home, e);
    else this.base.lerp(this.home, Math.min(1, dt * 6));
    this.group.position.copy(this.base).add(this.shift);
    const jiggle = Math.sin(this.wiggle * 30) * this.wiggle;
    this.group.position.x += jiggle * 0.012;
    this.group.position.y += Math.sin(e * Math.PI) * (this.gentle ? 0.05 : 0.25) + Math.sin(this.flip * Math.PI) * 0.12 + Math.abs(jiggle) * 0.006;
    this.group.rotation.y = this.yaw + this.skew + jiggle * 0.12;
    // face down = front pointing at the felt
    this.card.rotation.x = Math.PI / 2 - this.flip * Math.PI;
    this.card.rotation.z = (1 - e) * (this.gentle ? 0.7 : 4);
  }

  /** World position of the card, for chips flying out of it. */
  get position() {
    return this.home;
  }
}

const CHIP_COLORS = { 1: "#c0392b", 5: "#2d6cdf", 25: "#151515", 100: "#e6be5a" } as const;
let chipGeo: THREE.CylinderGeometry | null = null;
const chipMats = new Map<string, THREE.Material>();
export function makeChip(color: string): THREE.Mesh {
  chipGeo ??= new THREE.CylinderGeometry(0.042, 0.042, 0.012, 20);
  let mat = chipMats.get(color);
  if (!mat) {
    const tex = canvasTex(64, 64, (g) => {
      g.fillStyle = color; g.fillRect(0, 0, 64, 64);
      g.fillStyle = "#f3e7cf";
      for (let i = 0; i < 6; i++) { g.save(); g.translate(32, 32); g.rotate((i / 6) * Math.PI * 2); g.fillRect(-4, -32, 8, 10); g.restore(); }
      g.strokeStyle = "#f3e7cf"; g.lineWidth = 2; g.beginPath(); g.arc(32, 32, 16, 0, Math.PI * 2); g.stroke();
    });
    mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4 });
    chipMats.set(color, mat);
  }
  const m = new THREE.Mesh(chipGeo, mat);
  m.castShadow = true;
  return m;
}

/** Breaks an amount into a capped list of chip colours, biggest first. */
export function chipBreakdown(amount: number, cap = 40): string[] {
  const out: string[] = [];
  let left = Math.floor(amount);
  for (const d of [100, 25, 5, 1] as const) {
    while (left >= d && out.length < cap) { out.push(CHIP_COLORS[d]); left -= d; }
  }
  return out;
}

export function stackChips(group: THREE.Group, amount: number, seed = 1) {
  group.clear();
  const colors = chipBreakdown(amount);
  let rnd = seed;
  const rand = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647);
  const perStack = 8;
  colors.forEach((c, i) => {
    const stack = Math.floor(i / perStack);
    const chip = makeChip(c);
    const a = stack * 2.4;
    const r = stack === 0 ? 0 : 0.06 + stack * 0.012;
    chip.position.set(Math.cos(a) * r + (rand() - 0.5) * 0.006, 0.006 + (i % perStack) * 0.0125, Math.sin(a) * r + (rand() - 0.5) * 0.006);
    chip.rotation.y = rand() * 6;
    group.add(chip);
  });
}

export class World {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(70, 1, 0.03, 60);
  readonly renderer: THREE.WebGLRenderer;
  readonly interactive: THREE.Object3D[] = [];
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

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    const s = this.scene;
    s.background = new THREE.Color("#07050a");
    s.fog = new THREE.Fog("#07050a", 6, 16);
    s.add(this.camera);

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
    this.ticketPaper.userData.kind = "ticket";
    this.interactive.push(this.ticketPaper);
    s.add(this.ticketPaper);
    this.setTicket(null);

    this.pot.position.set(0.55, TABLE_Y, 0);
    s.add(this.pot);

    this.duck = buildDuck();
    this.duck.position.set(0.3, TABLE_Y, 0.42);
    this.duck.rotation.y = -0.8;
    this.duck.traverse((o) => (o.userData.kind = "duck"));
    this.interactive.push(this.duck);
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

  hopDuck() { this.duckHop = 1; }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 0.9 ? 85 : 70;
    this.camera.updateProjectionMatrix();
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
    this.renderer.render(this.scene, this.camera);
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
