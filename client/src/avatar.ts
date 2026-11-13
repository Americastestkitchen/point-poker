// "Pointlings": googly-eyed bean creatures that sit at the table.
import * as THREE from "three";
import type { BodyId } from "../../shared/catalog/bodies.ts";
import type { CosmeticId } from "../../shared/catalog/cosmetics.ts";
import { EMOTES, type EmoteId } from "../../shared/catalog/emotes.ts";

type Body = BodyId;
type Emote = EmoteId;
type Hat = CosmeticId | "none";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { FONT, canvasTex } from "./scene/textures.ts";

/** Where the face, arms and hat sit on each body shape. */
interface Shape {
  torso: () => THREE.Mesh;
  eye: { x: number; y: number; z: number; s: number };
  mouth: { y: number; z: number; s: number };
  belly: { y: number; z: number; sx: number; sy: number } | null;
  shoulder: { x: number; y: number };
  /** Hat height offset from the bean's head. */
  hatY: number;
  hatS: number;
}

const SHAPES: Record<Body, Shape> = {
  bean: {
    torso: () => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.38, 8, 20)); m.position.y = 0.92; return m; },
    eye: { x: 0.105, y: 1.13, z: 0.2, s: 1 }, mouth: { y: 0.97, z: 0.255, s: 1 },
    belly: { y: 0.82, z: 0.16, sx: 1, sy: 1.1 }, shoulder: { x: 0.25, y: 0.9 }, hatY: 0, hatS: 1,
  },
  chonk: {
    torso: () => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.4, 28, 20)); m.scale.set(1.15, 0.85, 1); m.position.y = 0.86; return m; },
    eye: { x: 0.15, y: 1.03, z: 0.29, s: 1.05 }, mouth: { y: 0.89, z: 0.395, s: 1.3 },
    belly: { y: 0.74, z: 0.27, sx: 1.6, sy: 0.9 }, shoulder: { x: 0.44, y: 0.84 }, hatY: -0.15, hatS: 1.15,
  },
  noodle: {
    torso: () => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.78, 8, 18)); m.position.y = 1.04; return m; },
    eye: { x: 0.075, y: 1.42, z: 0.115, s: 0.78 }, mouth: { y: 1.29, z: 0.166, s: 0.7 },
    belly: { y: 0.86, z: 0.1, sx: 0.65, sy: 1.7 }, shoulder: { x: 0.17, y: 0.98 }, hatY: 0.25, hatS: 0.75,
  },
  box: {
    torso: () => { const m = new THREE.Mesh(new RoundedBoxGeometry(0.58, 0.74, 0.48, 4, 0.08)); m.position.y = 0.95; return m; },
    eye: { x: 0.13, y: 1.12, z: 0.19, s: 1 }, mouth: { y: 0.96, z: 0.242, s: 1.2 },
    belly: null, shoulder: { x: 0.31, y: 0.92 }, hatY: -0.04, hatS: 1.1,
  },
  pear: {
    torso: () => {
      const pts = [[0, 0.5], [0.3, 0.52], [0.37, 0.63], [0.37, 0.78], [0.29, 0.97], [0.21, 1.12], [0.19, 1.24], [0.16, 1.34], [0.09, 1.41], [0, 1.43]]
        .map(([r, y]) => new THREE.Vector2(r, y));
      return new THREE.Mesh(new THREE.LatheGeometry(new THREE.SplineCurve(pts).getPoints(40), 28));
    },
    eye: { x: 0.085, y: 1.2, z: 0.13, s: 0.85 }, mouth: { y: 1.02, z: 0.262, s: 0.95 },
    belly: { y: 0.72, z: 0.24, sx: 1.4, sy: 1.0 }, shoulder: { x: 0.3, y: 0.86 }, hatY: 0.06, hatS: 0.85,
  },
};

let gradient: THREE.DataTexture | null = null;
export function toon(color: THREE.ColorRepresentation, extra: Partial<THREE.MeshToonMaterialParameters> = {}) {
  if (!gradient) {
    gradient = new THREE.DataTexture(new Uint8Array([60, 140, 255]), 3, 1, THREE.RedFormat);
    gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
    gradient.needsUpdate = true;
  }
  return new THREE.MeshToonMaterial({ color, gradientMap: gradient, ...extra });
}

const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, shadow = true) => {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = shadow;
  return m;
};

const EMOJI = Object.fromEntries(EMOTES.map((e) => [e.id, e.emoji])) as Record<Emote, string>;

function buildHat(hat: Hat | "visor"): THREE.Group {
  const g = new THREE.Group();
  const top = 1.36;
  switch (hat) {
    case "beanie": {
      const cap = mesh(new THREE.SphereGeometry(0.25, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), toon("#3b7dd8"));
      cap.position.y = top - 0.12;
      g.add(cap);
      const stick = mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.1), toon("#ddd"));
      stick.position.y = top + 0.16;
      g.add(stick);
      const prop = new THREE.Group();
      prop.name = "spin";
      prop.position.y = top + 0.21;
      for (const [c, r] of [["#ff4757", 0], ["#ffd23f", Math.PI]] as const) {
        const b = mesh(new THREE.BoxGeometry(0.18, 0.01, 0.05), toon(c));
        b.position.x = 0.09;
        const piv = new THREE.Group();
        piv.rotation.y = r;
        piv.add(b);
        prop.add(piv);
      }
      g.add(prop);
      break;
    }
    case "tophat": {
      const brim = mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.02, 24), toon("#1a1a1a"));
      brim.position.y = top - 0.04;
      const crown = mesh(new THREE.CylinderGeometry(0.17, 0.18, 0.32, 24), toon("#1a1a1a"));
      crown.position.y = top + 0.12;
      const band = mesh(new THREE.CylinderGeometry(0.182, 0.182, 0.05, 24), toon("#b23a2e"));
      band.position.y = top + 0.0;
      g.add(brim, crown, band);
      break;
    }
    case "cone": {
      const base = mesh(new THREE.BoxGeometry(0.36, 0.03, 0.36), toon("#ff6a13"));
      base.position.y = top - 0.04;
      const c = mesh(new THREE.ConeGeometry(0.15, 0.45, 20), toon("#ff6a13"));
      c.position.y = top + 0.2;
      const stripe = mesh(new THREE.CylinderGeometry(0.085, 0.11, 0.08, 20), toon("#ffffff"));
      stripe.position.y = top + 0.22;
      g.add(base, c, stripe);
      break;
    }
    case "party": {
      const tex = canvasTex(64, 64, (x) => {
        for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? "#ff5fa2" : "#4ad6ff"; x.fillRect(i * 8, 0, 8, 64); }
      });
      const c = mesh(new THREE.ConeGeometry(0.12, 0.36, 20), toon("#fff", { map: tex }));
      c.position.y = top + 0.14;
      c.rotation.z = 0.15;
      const pom = mesh(new THREE.SphereGeometry(0.045, 10, 8), toon("#ffd23f"));
      pom.position.set(-0.027, top + 0.33, 0);
      g.add(c, pom);
      break;
    }
    case "chef": {
      const band = mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.16, 20), toon("#ffffff"));
      band.position.y = top + 0.02;
      g.add(band);
      for (let i = 0; i < 5; i++) {
        const puff = mesh(new THREE.SphereGeometry(0.1, 12, 10), toon("#ffffff"));
        const a = (i / 5) * Math.PI * 2;
        puff.position.set(Math.cos(a) * 0.09, top + 0.15, Math.sin(a) * 0.09);
        g.add(puff);
      }
      const mid = mesh(new THREE.SphereGeometry(0.12, 12, 10), toon("#ffffff"));
      mid.position.y = top + 0.2;
      g.add(mid);
      break;
    }
    case "horns": {
      const helm = mesh(new THREE.SphereGeometry(0.265, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2.4), toon("#8a8f98"));
      helm.position.y = top - 0.14;
      g.add(helm);
      for (const s of [-1, 1]) {
        const h = mesh(new THREE.ConeGeometry(0.05, 0.25, 12), toon("#efe4c8"));
        h.position.set(s * 0.26, top + 0.02, 0);
        h.rotation.z = -s * 0.9;
        g.add(h);
      }
      break;
    }
    case "fez": {
      const f = mesh(new THREE.CylinderGeometry(0.11, 0.15, 0.2, 20), toon("#b3202a"));
      f.position.y = top + 0.04;
      const tassel = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16), toon("#111"));
      tassel.position.set(0.1, top + 0.08, 0);
      tassel.rotation.z = 0.5;
      g.add(f, tassel);
      break;
    }
    case "crown": {
      const ring = mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 20, 1, true), toon("#e6be5a", { side: THREE.DoubleSide }));
      ring.position.y = top + 0.0;
      g.add(ring);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const s = mesh(new THREE.ConeGeometry(0.03, 0.09, 8), toon("#e6be5a"));
        s.position.set(Math.cos(a) * 0.16, top + 0.08, Math.sin(a) * 0.16);
        g.add(s);
      }
      break;
    }
    case "visor": {
      const band = mesh(new THREE.CylinderGeometry(0.265, 0.265, 0.05, 24, 1, true), toon("#163a22", { side: THREE.DoubleSide }));
      band.position.y = top - 0.12;
      const brim = mesh(
        new THREE.CylinderGeometry(0.42, 0.42, 0.01, 24, 1, false, -Math.PI / 2.5, (Math.PI * 2) / 2.5),
        new THREE.MeshPhysicalMaterial({ color: "#2fbf5a", transparent: true, opacity: 0.6, roughness: 0.3 }),
      );
      brim.position.set(0, top - 0.1, 0.0);
      brim.rotation.x = 0.25;
      g.add(band, brim);
      break;
    }
  }
  return g;
}

function tagTexture(name: string, line2: string, color: string) {
  return canvasTex(512, 160, (g) => {
    g.font = `bold 56px ${FONT}`;
    const w = Math.min(500, Math.max(g.measureText(name).width, 200) + 60);
    g.fillStyle = "rgba(10,6,12,0.72)";
    g.beginPath();
    g.roundRect(256 - w / 2, 8, w, 144, 30);
    g.fill();
    g.fillStyle = color;
    g.fillRect(256 - w / 2 + 20, 18, w - 40, 6);
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = "#fff";
    g.fillText(name, 256, 64, 480);
    g.font = `40px ${FONT}`;
    g.fillStyle = "#e6be5a";
    g.fillText(line2, 256, 118);
  });
}

function bubbleTexture(text: string) {
  return canvasTex(128, 128, (g) => {
    g.fillStyle = "rgba(255,255,255,0.92)";
    g.beginPath();
    g.arc(64, 58, 50, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(40, 96); g.lineTo(30, 124); g.lineTo(66, 104);
    g.fill();
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = text.length > 1 && !/\p{Extended_Pictographic}/u.test(text) ? `bold 48px ${FONT}` : `60px "Noto Color Emoji", sans-serif`;
    g.fillStyle = "#2a1d17";
    g.fillText(text, 64, 62);
  });
}

export class Avatar {
  readonly group = new THREE.Group();
  readonly body = new THREE.Group();
  private bodyMat: THREE.MeshToonMaterial;
  private hatGroup = new THREE.Group();
  private pupils: { mesh: THREE.Mesh; off: THREE.Vector2; vel: THREE.Vector2 }[] = [];
  private eyes: THREE.Group[] = [];
  private arms: THREE.Group[] = [];
  /** Arm + hand meshes per side, so arms can stretch rubber-hose style. */
  private limbs: { arm: THREE.Mesh; hand: THREE.Mesh }[] = [];
  /** Seconds into the "reach out and put a card down" move, or -1. */
  private placeT = -1;
  private smile!: THREE.Mesh;
  private mouthHole!: THREE.Mesh;
  /** Mic loudness from the network, 0..1. */
  private talkTarget = 0;
  private talkAt = 0;
  private talk = 0;
  /** Seconds into the "square up my card" fidget, or -1. */
  private adjustT = -1;
  private tag: THREE.Sprite;
  private bubble: THREE.Sprite;
  private bubbleText = "";
  private emoteSprite: THREE.Sprite | null = null;
  private emote: Emote | null = null;
  private emoteT = 0;
  private yaw = 0;
  private pitch = 0;
  private targetYaw = 0;
  private targetPitch = 0;
  private bonkT = 0;
  private celebrateT = 0;
  private phase = Math.random() * 10;
  private tagKey = "";
  private hat: Hat = "none";
  readonly hitbox: THREE.Mesh;
  dimmed = false;

  readonly id: string;
  readonly isDealer: boolean;
  readonly shape: Body;
  private eyeScale = 1;

  constructor(id: string, color: string, hat: Hat, isDealer: boolean, shape: Body = "bean") {
    this.id = id;
    this.isDealer = isDealer;
    this.shape = SHAPES[shape] ? shape : "bean";
    const S = SHAPES[this.shape];
    this.bodyMat = toon(color);
    const torso = S.torso();
    torso.material = this.bodyMat;
    torso.castShadow = true;
    this.body.add(torso);

    if (S.belly) {
      const belly = mesh(new THREE.SphereGeometry(0.2, 16, 12), toon("#ffffff", { transparent: true, opacity: 0.25 }), false);
      belly.scale.set(S.belly.sx, S.belly.sy, 0.5);
      belly.position.set(0, S.belly.y, S.belly.z);
      this.body.add(belly);
    }

    this.eyeScale = S.eye.s;
    for (const s of [-1, 1]) {
      const eye = new THREE.Group();
      eye.position.set(s * S.eye.x, S.eye.y, S.eye.z);
      eye.scale.setScalar(S.eye.s);
      const white = mesh(new THREE.SphereGeometry(0.115, 20, 16), toon("#ffffff"));
      const pupil = mesh(new THREE.SphereGeometry(0.052, 14, 10), new THREE.MeshBasicMaterial({ color: "#111" }), false);
      eye.add(white, pupil);
      this.body.add(eye);
      this.eyes.push(eye);
      this.pupils.push({ mesh: pupil, off: new THREE.Vector2(), vel: new THREE.Vector2() });
    }

    const mouth = mesh(new THREE.TorusGeometry(0.055, 0.013, 6, 16, Math.PI), new THREE.MeshBasicMaterial({ color: "#2a1414" }), false);
    mouth.position.set(0, S.mouth.y, S.mouth.z);
    mouth.scale.setScalar(S.mouth.s);
    mouth.rotation.z = Math.PI;
    this.body.add(mouth);
    this.smile = mouth;
    // open mouth for talking: a dark oval with a little tongue
    const hole = mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: "#2a1414" }), false);
    const tongue = mesh(new THREE.SphereGeometry(0.55, 12, 8), new THREE.MeshBasicMaterial({ color: "#d9566a" }), false);
    tongue.position.set(0, -0.45, 0.35);
    tongue.scale.set(1, 0.6, 0.5);
    hole.add(tongue);
    hole.position.set(0, S.mouth.y - 0.025 * S.mouth.s, S.mouth.z - 0.003);
    hole.userData.s = S.mouth.s;
    hole.scale.set(0.05, 0.001, 0.025);
    hole.visible = false;
    this.body.add(hole);
    this.mouthHole = hole;

    for (const s of [-1, 1]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(s * S.shoulder.x, S.shoulder.y, 0.02);
      const arm = mesh(new THREE.CapsuleGeometry(0.055, 0.22, 4, 10), this.bodyMat);
      arm.position.y = -0.14;
      const hand = mesh(new THREE.SphereGeometry(0.07, 12, 10), this.bodyMat);
      hand.position.y = -0.3;
      shoulder.add(arm, hand);
      this.limbs.push({ arm, hand });
      shoulder.rotation.x = -1.15;
      shoulder.rotation.z = s * 0.25;
      this.body.add(shoulder);
      this.arms.push(shoulder);
    }

    if (isDealer) {
      const bow = new THREE.Group();
      for (const s of [-1, 1]) {
        const w = mesh(new THREE.ConeGeometry(0.05, 0.09, 4), toon("#b3202a"));
        w.rotation.z = s * Math.PI / 2;
        w.position.x = s * 0.045;
        bow.add(w);
      }
      bow.position.set(0, S.mouth.y - 0.13, S.mouth.z - 0.01);
      this.body.add(bow);
      const visor = buildHat("visor");
      visor.position.y = S.hatY;
      visor.scale.setScalar(S.hatS);
      // scale around the head, not the floor
      visor.position.y += 1.36 * (1 - S.hatS);
      this.body.add(visor);
    }
    this.hatGroup.position.y = S.hatY + 1.36 * (1 - S.hatS);
    this.hatGroup.scale.setScalar(S.hatS);
    this.body.add(this.hatGroup);
    this.setHat(hat);

    // chair
    const wood = toon("#3a2216");
    const seat = mesh(new THREE.BoxGeometry(0.56, 0.06, 0.52), wood);
    seat.position.set(0, 0.5, -0.04);
    const back = mesh(new THREE.BoxGeometry(0.56, 0.7, 0.06), wood);
    back.position.set(0, 0.86, -0.3);
    back.rotation.x = -0.08;
    this.group.add(seat, back);
    for (const [x, z] of [[-0.24, -0.26], [0.24, -0.26], [-0.24, 0.18], [0.24, 0.18]]) {
      const leg = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.48), wood);
      leg.position.set(x, 0.24, z);
      this.group.add(leg);
    }
    if (isDealer) {
      // a fancier chair for the house
      const crest = mesh(new THREE.TorusGeometry(0.2, 0.03, 8, 20, Math.PI), toon("#e6be5a"));
      crest.position.set(0, 1.2, -0.31);
      this.group.add(crest);
    }

    this.hitbox = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 1.0), new THREE.MeshBasicMaterial({ visible: false }));
    this.hitbox.position.y = 1.0;
    this.hitbox.userData.avatarId = id;
    this.group.add(this.hitbox);

    this.group.add(this.body);

    this.tag = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false, transparent: true }));
    this.tag.scale.set(0.9, 0.28, 1);
    this.tag.position.y = 1.95 + Math.max(0, S.hatY);
    this.tag.visible = false;
    this.tag.renderOrder = 10;
    this.group.add(this.tag);

    this.bubble = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false, transparent: true }));
    this.bubble.scale.set(0.24, 0.24, 1);
    this.bubble.position.set(0.32 + Math.max(0, S.shoulder.x - 0.25), 1.62 + Math.max(0, S.hatY), 0);
    this.bubble.renderOrder = 10;
    this.bubble.visible = false;
    this.group.add(this.bubble);
  }

  setHat(hat: Hat) {
    if (hat === this.hat && this.hatGroup.children.length) return;
    this.hat = hat;
    this.hatGroup.clear();
    if (hat !== "none") {
      const h = buildHat(hat);
      if (this.isDealer) h.position.y += 0.04;
      h.rotation.z = (Math.random() - 0.5) * 0.25;
      this.hatGroup.add(h);
    }
  }

  setStyle(color: string, hat: Hat) {
    this.bodyMat.color.set(color);
    this.setHat(hat);
  }

  setTag(name: string, chips: number, color: string, connected: boolean) {
    const line2 = connected ? `🪙 ${chips}` : "zzz (away)";
    const key = name + line2 + color;
    if (key === this.tagKey) return;
    this.tagKey = key;
    this.tag.material.map?.dispose();
    this.tag.material.map = tagTexture(name, line2, color);
    this.tag.material.needsUpdate = true;
    this.tag.visible = true;
    this.dimmed = !connected;
    this.bodyMat.transparent = !connected;
    this.bodyMat.opacity = connected ? 1 : 0.45;
  }

  /** "" hides it; otherwise a short text or emoji. */
  setBubble(text: string) {
    if (text === this.bubbleText) return;
    this.bubbleText = text;
    this.bubble.visible = !!text;
    if (text) {
      this.bubble.material.map?.dispose();
      this.bubble.material.map = bubbleTexture(text);
      this.bubble.material.needsUpdate = true;
    }
  }

  setLook(yaw: number, pitch: number) {
    this.targetYaw = yaw;
    this.targetPitch = pitch;
  }

  playEmote(kind: Emote) {
    this.emote = kind;
    this.emoteT = 0;
    if (this.emoteSprite) this.group.remove(this.emoteSprite);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: bubbleTexture(EMOJI[kind]), depthTest: false, transparent: true }));
    s.scale.set(0.4, 0.4, 1);
    s.position.y = 1.6;
    s.renderOrder = 11;
    this.emoteSprite = s;
    this.group.add(s);
  }

  bonk() {
    this.bonkT = 1;
    for (const p of this.pupils) p.vel.set((Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40);
  }

  celebrate() {
    this.celebrateT = 2.2;
  }

  /** Mic loudness for this player; the mouth flaps while it's above zero. */
  setTalk(level: number) {
    this.talkTarget = level;
    this.talkAt = performance.now();
  }

  /** Lean in, stretch an arm across the felt and set a card down; then square it up. */
  placeCard() {
    this.placeT = 0;
    this.adjustT = -1;
  }

  /** Both hands reach in and fiddle the card straight. */
  adjustCard() {
    if (this.placeT >= 0) return;
    this.adjustT = 0;
  }

  get busyWithCard() { return this.placeT >= 0 || this.adjustT >= 0; }

  /** Where the right hand is right now (world space). */
  handWorldPos(out = new THREE.Vector3()) {
    return this.limbs[1].hand.getWorldPosition(out);
  }

  headWorldPos(out = new THREE.Vector3()) {
    return this.body.localToWorld(out.set(0, 1.15, 0.1));
  }

  update(dt: number, t: number) {
    this.yaw += (this.targetYaw - this.yaw) * Math.min(1, dt * 8);
    this.pitch += (this.targetPitch - this.pitch) * Math.min(1, dt * 8);
    const tt = t + this.phase;

    // idle breathing + bonk squash + celebration hops
    let sy = 1 + Math.sin(tt * 2.1) * 0.02;
    let sx = 1 - Math.sin(tt * 2.1) * 0.01;
    let hop = 0;
    if (this.bonkT > 0) {
      this.bonkT = Math.max(0, this.bonkT - dt * 2.2);
      const k = Math.sin(this.bonkT * 14) * this.bonkT;
      sy -= k * 0.25;
      sx += k * 0.18;
    }
    if (this.celebrateT > 0) {
      this.celebrateT = Math.max(0, this.celebrateT - dt);
      hop = Math.abs(Math.sin(this.celebrateT * 7)) * 0.18 * Math.min(1, this.celebrateT);
    }
    this.body.scale.set(sx, sy, sx);
    this.body.position.y = hop;
    this.body.rotation.y = this.yaw * 0.6;
    this.body.rotation.x = -this.pitch * 0.25;
    this.body.rotation.z = 0;

    // emotes
    let armL = -1.15, armR = -1.15;
    if (this.celebrateT > 0) { armL = armR = -2.9 + Math.sin(tt * 18) * 0.3; }
    if (this.emote) {
      this.emoteT += dt;
      const e = this.emoteT;
      if (this.emote === "wave") armR = -2.6 + Math.sin(e * 16) * 0.5;
      if (this.emote === "laugh") { this.body.rotation.z = Math.sin(e * 30) * 0.06; this.body.position.y += Math.abs(Math.sin(e * 20)) * 0.04; }
      if (this.emote === "think") { this.body.rotation.z = 0.2 * Math.min(1, e * 4); armL = -2.4; }
      if (this.emote === "shock") { this.body.position.y += Math.max(0, 0.15 - e * 0.4); for (const eye of this.eyes) eye.scale.setScalar(1.3 * this.eyeScale); }
      if (this.emoteSprite) {
        this.emoteSprite.position.y = 1.6 + e * 0.25;
        this.emoteSprite.material.opacity = Math.max(0, 1 - Math.max(0, e - 1.4) * 2);
      }
      if (e > 2) {
        this.emote = null;
        for (const eye of this.eyes) eye.scale.setScalar(this.eyeScale);
        if (this.emoteSprite) { this.group.remove(this.emoteSprite); this.emoteSprite.material.map?.dispose(); this.emoteSprite = null; }
      }
    }
    // card handling: reach out (right arm), let go, then both hands square it up
    let stretchL = 1, stretchR = 1, lean = 0, zL = -0.25, zR = 0.25, armSpeed = 12;
    const ease = (x: number) => { const c = Math.min(1, Math.max(0, x)); return c * c * (3 - 2 * c); };
    const fiddle = (e: number, len: number) => {
      // e: 0..len. In, wiggle, out.
      const k = ease(e / 0.18) * (1 - ease((e - (len - 0.2)) / 0.2));
      const w = Math.sin(e * 24) * 0.09 * k;
      armL = -1.15 + (-1.62 + 1.15) * k + w * 0.6;
      armR = -1.15 + (-1.62 + 1.15) * k - w * 0.6;
      stretchL = stretchR = 1 + 1.25 * k;
      zL = -0.25 + 0.22 * k + w;
      zR = 0.25 - 0.22 * k + w;
      lean = 0.14 * k;
    };
    if (this.placeT >= 0) {
      this.placeT += dt;
      const e = this.placeT;
      armSpeed = 22;
      if (e < 0.55) {
        // reach: right arm swings forward and stretches out to the felt
        const k = ease(e / 0.32) * (1 - ease((e - 0.4) / 0.15) * 0.5);
        armR = -1.15 + (-1.58 + 1.15) * k;
        stretchR = 1 + 1.5 * k;
        zR = 0.25 - 0.2 * k;
        lean = 0.18 * k;
      } else if (e < 1.45) fiddle(e - 0.55, 0.9);
      else this.placeT = -1;
    } else if (this.adjustT >= 0) {
      this.adjustT += dt;
      armSpeed = 22;
      if (this.adjustT < 0.8) fiddle(this.adjustT, 0.8);
      else this.adjustT = -1;
    }
    this.body.rotation.x += lean;
    const a = Math.min(1, dt * armSpeed);
    this.arms[0].rotation.x += (armL - this.arms[0].rotation.x) * a;
    this.arms[1].rotation.x += (armR - this.arms[1].rotation.x) * a;
    this.arms[0].rotation.z += (zL - this.arms[0].rotation.z) * a;
    this.arms[1].rotation.z += (zR - this.arms[1].rotation.z) * a;
    for (const [i, st] of [stretchL, stretchR].entries()) {
      const l = this.limbs[i];
      const cur = l.arm.scale.y + (st - l.arm.scale.y) * a;
      l.arm.scale.set(1, cur, 1);
      l.arm.position.y = -0.14 * cur;
      l.hand.position.y = -0.3 * cur;
    }

    // talking: mouth flaps with mic loudness (a little extra chatter so it reads as speech)
    if (this.talkTarget > 0 && performance.now() - this.talkAt > 1500) this.talkTarget = 0; // lost the "stopped" message
    this.talk += (this.talkTarget - this.talk) * Math.min(1, dt * 18);
    const open = this.talk < 0.02 ? 0 : Math.min(1, this.talk * 1.4) * (0.45 + 0.55 * Math.abs(Math.sin(tt * 15)));
    this.mouthHole.visible = open > 0.03;
    this.smile.visible = !this.mouthHole.visible;
    const ms = this.mouthHole.userData.s ?? 1;
    this.mouthHole.scale.set((0.05 + open * 0.02) * ms, (0.016 + open * 0.07) * ms, 0.03);

    // googly pupils: springs toward where we're looking, with wobble
    const tx = THREE.MathUtils.clamp(Math.sin(this.yaw) * 0.5, -0.6, 0.6);
    const ty = THREE.MathUtils.clamp(this.pitch * 0.8, -0.6, 0.6);
    for (const p of this.pupils) {
      p.vel.x += ((tx - p.off.x) * 120 - p.vel.x * 7) * dt;
      p.vel.y += ((ty - p.off.y) * 120 - p.vel.y * 7 - 6) * dt;
      p.off.addScaledVector(p.vel, dt);
      if (p.off.length() > 0.75) p.off.setLength(0.75);
      const z = Math.sqrt(Math.max(0, 1 - p.off.lengthSq()));
      p.mesh.position.set(p.off.x, p.off.y, z).multiplyScalar(0.08);
    }

    const spin = this.hatGroup.getObjectByName("spin");
    if (spin) spin.rotation.y += dt * 12;
  }
}
