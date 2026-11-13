// Everything a bean does, as numbers: breathing, emotes, getting bonked,
// celebrating, putting a card down, talking and looking around. It has three
// layers (body, arms, face) and produces a Pose; the rig turns that into
// meshes. No three.js here, so the same animator can drive the bean and the
// first-person arms (#6), and tests can run it.
import { EMOTE_IDS, type EmoteId } from "../../../shared/catalog/emotes.ts";

export type ClipId = EmoteId | "bonked" | "celebrate" | "placeCard" | "adjustCard";

/** How the hands hold the cards (#7 animates these). */
export type HandPose = { kind: "none" } | { kind: "deciding" } | { kind: "committed"; variant: number };

export interface ArmPose {
  /** Shoulder swing forward/back and out to the side. */
  x: number;
  z: number;
  /** Rubber-hose stretch: 1 is resting length. */
  stretch: number;
}

export interface Pose {
  body: { sx: number; sy: number; y: number; rotX: number; rotY: number; rotZ: number };
  /** Left, then right. */
  arms: [ArmPose, ArmPose];
  face: {
    /** 0 closed (smiling) .. 1 wide open. */
    mouthOpen: number;
    /** Eye size relative to the shape's own. */
    eyeScale: number;
    /** Each pupil's offset on the eyeball, as a point on a unit sphere. */
    pupils: [{ x: number; y: number; z: number }, { x: number; y: number; z: number }];
  };
  /** The emote playing and how long it's been going, for the floating emoji. */
  emote: { id: EmoteId; t: number } | null;
}

const REST_ARM_X = -1.15;
const EMOTES = new Set<string>(EMOTE_IDS);
const ease = (x: number) => { const c = Math.min(1, Math.max(0, x)); return c * c * (3 - 2 * c); };

export class Animator {
  private readonly random: () => number;
  private readonly now: () => number;
  private readonly phase: number;
  private yaw = 0;
  private pitch = 0;
  private targetYaw = 0;
  private targetPitch = 0;
  private bonkT = 0;
  private celebrateT = 0;
  private emote: EmoteId | null = null;
  private emoteT = 0;
  /** Seconds into "reach out and put a card down", or -1. */
  private placeT = -1;
  /** Seconds into "square up my card", or -1. */
  private adjustT = -1;
  private talkTarget = 0;
  private talkAt = 0;
  private talk = 0;
  private readonly arms: [ArmPose, ArmPose] = [{ x: REST_ARM_X, z: -0.25, stretch: 1 }, { x: REST_ARM_X, z: 0.25, stretch: 1 }];
  private readonly pupils = [0, 1].map(() => ({ off: { x: 0, y: 0 }, vel: { x: 0, y: 0 } }));
  handPose: HandPose = { kind: "none" };

  constructor(deps: { random?: () => number; now?: () => number } = {}) {
    this.random = deps.random ?? Math.random;
    this.now = deps.now ?? (() => performance.now());
    this.phase = this.random() * 10;
  }

  play(clip: ClipId) {
    switch (clip) {
      case "bonked":
        this.bonkT = 1;
        for (const p of this.pupils) { p.vel.x = (this.random() - 0.5) * 40; p.vel.y = (this.random() - 0.5) * 40; }
        return;
      case "celebrate":
        this.celebrateT = 2.2;
        return;
      case "placeCard":
        this.placeT = 0;
        this.adjustT = -1;
        return;
      case "adjustCard":
        if (this.placeT < 0) this.adjustT = 0;
        return;
      default:
        if (EMOTES.has(clip)) { this.emote = clip; this.emoteT = 0; }
    }
  }

  /** Where they're looking, relative to facing the table. */
  setGaze(yaw: number, pitch: number) {
    this.targetYaw = yaw;
    this.targetPitch = pitch;
  }

  /** Mic loudness 0..1; the mouth flaps while it's above zero. */
  setTalk(level: number) {
    this.talkTarget = level;
    this.talkAt = this.now();
  }

  get busyWithCard() { return this.placeT >= 0 || this.adjustT >= 0; }

  update(dt: number, t: number): Pose {
    this.yaw += (this.targetYaw - this.yaw) * Math.min(1, dt * 8);
    this.pitch += (this.targetPitch - this.pitch) * Math.min(1, dt * 8);
    const tt = t + this.phase;

    // ---- body layer: breathing, bonk squash, celebration hops, emotes
    let sy = 1 + Math.sin(tt * 2.1) * 0.02;
    let sx = 1 - Math.sin(tt * 2.1) * 0.01;
    let y = 0;
    if (this.bonkT > 0) {
      this.bonkT = Math.max(0, this.bonkT - dt * 2.2);
      const k = Math.sin(this.bonkT * 14) * this.bonkT;
      sy -= k * 0.25;
      sx += k * 0.18;
    }
    if (this.celebrateT > 0) {
      this.celebrateT = Math.max(0, this.celebrateT - dt);
      y = Math.abs(Math.sin(this.celebrateT * 7)) * 0.18 * Math.min(1, this.celebrateT);
    }
    let rotZ = 0;
    let eyeScale = 1;
    let armL = REST_ARM_X, armR = REST_ARM_X;
    if (this.celebrateT > 0) { armL = armR = -2.9 + Math.sin(tt * 18) * 0.3; }
    let emote: Pose["emote"] = null;
    if (this.emote) {
      this.emoteT += dt;
      const e = this.emoteT;
      if (this.emote === "wave") armR = -2.6 + Math.sin(e * 16) * 0.5;
      if (this.emote === "laugh") { rotZ = Math.sin(e * 30) * 0.06; y += Math.abs(Math.sin(e * 20)) * 0.04; }
      if (this.emote === "think") { rotZ = 0.2 * Math.min(1, e * 4); armL = -2.4; }
      if (this.emote === "shock") { y += Math.max(0, 0.15 - e * 0.4); eyeScale = 1.3; }
      if (e > 2) { this.emote = null; eyeScale = 1; }
      else emote = { id: this.emote, t: e };
    }

    // ---- arms layer: card handling (reach out with the right arm, let go, both hands square it up)
    let stretchL = 1, stretchR = 1, lean = 0, zL = -0.25, zR = 0.25, armSpeed = 12;
    const fiddle = (e: number, len: number) => {
      // e: 0..len. In, wiggle, out.
      const k = ease(e / 0.18) * (1 - ease((e - (len - 0.2)) / 0.2));
      const w = Math.sin(e * 24) * 0.09 * k;
      armL = REST_ARM_X + (-1.62 - REST_ARM_X) * k + w * 0.6;
      armR = REST_ARM_X + (-1.62 - REST_ARM_X) * k - w * 0.6;
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
        armR = REST_ARM_X + (-1.58 - REST_ARM_X) * k;
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
    const a = Math.min(1, dt * armSpeed);
    const [L, R] = this.arms;
    L.x += (armL - L.x) * a;
    R.x += (armR - R.x) * a;
    L.z += (zL - L.z) * a;
    R.z += (zR - R.z) * a;
    L.stretch += (stretchL - L.stretch) * a;
    R.stretch += (stretchR - R.stretch) * a;

    // ---- face layer: talking (a little extra chatter so it reads as speech) and googly pupils
    if (this.talkTarget > 0 && this.now() - this.talkAt > 1500) this.talkTarget = 0; // lost the "stopped" message
    this.talk += (this.talkTarget - this.talk) * Math.min(1, dt * 18);
    const mouthOpen = this.talk < 0.02 ? 0 : Math.min(1, this.talk * 1.4) * (0.45 + 0.55 * Math.abs(Math.sin(tt * 15)));
    // pupils spring toward where we're looking, with wobble
    const tx = Math.min(0.6, Math.max(-0.6, Math.sin(this.yaw) * 0.5));
    const ty = Math.min(0.6, Math.max(-0.6, this.pitch * 0.8));
    const pupils = this.pupils.map((p) => {
      p.vel.x += ((tx - p.off.x) * 120 - p.vel.x * 7) * dt;
      p.vel.y += ((ty - p.off.y) * 120 - p.vel.y * 7 - 6) * dt;
      p.off.x += p.vel.x * dt;
      p.off.y += p.vel.y * dt;
      const len = Math.hypot(p.off.x, p.off.y);
      if (len > 0.75) { p.off.x *= 0.75 / len; p.off.y *= 0.75 / len; }
      const z = Math.sqrt(Math.max(0, 1 - (p.off.x ** 2 + p.off.y ** 2)));
      return { x: p.off.x, y: p.off.y, z };
    }) as Pose["face"]["pupils"];

    return {
      body: { sx, sy, y, rotX: -this.pitch * 0.25 + lean, rotY: this.yaw * 0.6, rotZ },
      arms: [{ ...L }, { ...R }],
      face: { mouthOpen, eyeScale, pupils },
      emote,
    };
  }
}
