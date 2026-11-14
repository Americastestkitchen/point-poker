// Everything a bean does, as numbers: breathing, emotes, getting bonked,
// celebrating, putting a card down, flicking a chip, poking the duck, talking
// and looking around. It has three layers (body, arms, face) and produces a
// Pose; the rig turns that into meshes. No three.js here, so the same animator
// drives the bean and your first-person body, and tests can run it.
import { isEmote, type EmoteId } from "../../../shared/catalog/emotes.ts";

export type ClipId = EmoteId | "bonked" | "celebrate" | "placeCard" | "adjustCard" | Gesture;

/** A quick move of the right arm that wins over everything else for a moment. */
type Gesture = "flick" | "poke";

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
/** How long a flick and a poke take (seconds). */
const FLICK = 0.5,
  POKE = 0.6;
const ease = (x: number) => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
};

export interface Animator {
  play(clip: ClipId): void;
  /** Where they're looking, relative to facing the table. */
  setGaze(yaw: number, pitch: number): void;
  /** Mic loudness 0..1; the mouth flaps while it's above zero. */
  setTalk(level: number): void;
  /** Stored for #7, which animates it. */
  handPose: HandPose;
  readonly busyWithCard: boolean;
  /** Advances everything by `dt` seconds (`t` is the running clock) and returns the pose to show. */
  update(dt: number, t: number): Pose;
}

export function createAnimator(deps: { random?: () => number; now?: () => number } = {}): Animator {
  const random = deps.random ?? Math.random;
  const now = deps.now ?? (() => performance.now());
  const phase = random() * 10;
  let yaw = 0,
    pitch = 0,
    targetYaw = 0,
    targetPitch = 0;
  let bonkT = 0,
    celebrateT = 0;
  /** The emote playing, and how many seconds in. */
  let emote: { id: EmoteId; t: number } | null = null;
  /** What the hands are doing with the card, and how many seconds in. */
  let hands: { kind: "idle" } | { kind: "placing"; t: number } | { kind: "adjusting"; t: number } = { kind: "idle" };
  /** A flick or poke going on, and how many seconds in. */
  let gesture: { kind: Gesture; t: number } | null = null;
  let talkTarget = 0,
    talkAt = 0,
    talk = 0;
  const arms: [ArmPose, ArmPose] = [
    { x: REST_ARM_X, z: -0.25, stretch: 1 },
    { x: REST_ARM_X, z: 0.25, stretch: 1 },
  ];
  const pupil = () => ({ off: { x: 0, y: 0 }, vel: { x: 0, y: 0 } });
  const pupils: [ReturnType<typeof pupil>, ReturnType<typeof pupil>] = [pupil(), pupil()];

  return {
    handPose: { kind: "none" },

    play(clip) {
      switch (clip) {
        case "bonked":
          bonkT = 1;
          for (const p of pupils) {
            p.vel.x = (random() - 0.5) * 40;
            p.vel.y = (random() - 0.5) * 40;
          }
          return;
        case "celebrate":
          celebrateT = 2.2;
          return;
        case "placeCard":
          hands = { kind: "placing", t: 0 };
          return;
        case "adjustCard":
          // squaring it up waits until it's been put down
          if (hands.kind !== "placing") hands = { kind: "adjusting", t: 0 };
          return;
        case "flick":
        case "poke":
          gesture = { kind: clip, t: 0 };
          return;
        default:
          if (isEmote(clip)) emote = { id: clip, t: 0 };
      }
    },

    setGaze(y, p) {
      targetYaw = y;
      targetPitch = p;
    },

    setTalk(level) {
      talkTarget = level;
      talkAt = now();
    },

    get busyWithCard() {
      return hands.kind !== "idle";
    },

    update(dt, t) {
      yaw += (targetYaw - yaw) * Math.min(1, dt * 8);
      pitch += (targetPitch - pitch) * Math.min(1, dt * 8);
      const tt = t + phase;

      // ---- body layer: breathing, bonk squash, celebration hops, emotes
      let sy = 1 + Math.sin(tt * 2.1) * 0.02;
      let sx = 1 - Math.sin(tt * 2.1) * 0.01;
      let y = 0;
      if (bonkT > 0) {
        bonkT = Math.max(0, bonkT - dt * 2.2);
        const k = Math.sin(bonkT * 14) * bonkT;
        sy -= k * 0.25;
        sx += k * 0.18;
      }
      if (celebrateT > 0) {
        celebrateT = Math.max(0, celebrateT - dt);
        y = Math.abs(Math.sin(celebrateT * 7)) * 0.18 * Math.min(1, celebrateT);
      }
      let rotZ = 0;
      let eyeScale = 1;
      let armL = REST_ARM_X,
        armR = REST_ARM_X;
      if (celebrateT > 0) {
        armL = armR = -2.9 + Math.sin(tt * 18) * 0.3;
      }
      let playing: Pose["emote"] = null;
      if (emote) {
        emote.t += dt;
        const { id, t: e } = emote;
        if (id === "wave") armR = -2.6 + Math.sin(e * 16) * 0.5;
        if (id === "laugh") {
          rotZ = Math.sin(e * 30) * 0.06;
          y += Math.abs(Math.sin(e * 20)) * 0.04;
        }
        if (id === "think") {
          rotZ = 0.2 * Math.min(1, e * 4);
          armL = -2.4;
        }
        if (id === "shock") {
          y += Math.max(0, 0.15 - e * 0.4);
          eyeScale = 1.3;
        }
        if (e > 2) {
          emote = null;
          eyeScale = 1;
        } else playing = { id, t: e };
      }

      // ---- arms layer: card handling (reach out with the right arm, let go, both hands square it up)
      let stretchL = 1,
        stretchR = 1,
        lean = 0,
        zL = -0.25,
        zR = 0.25,
        armSpeed = 12;
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
      if (hands.kind === "placing") {
        hands.t += dt;
        const e = hands.t;
        armSpeed = 22;
        if (e < 0.55) {
          // reach: right arm swings forward and stretches out to the felt
          const k = ease(e / 0.32) * (1 - ease((e - 0.4) / 0.15) * 0.5);
          armR = REST_ARM_X + (-1.58 - REST_ARM_X) * k;
          stretchR = 1 + 1.5 * k;
          zR = 0.25 - 0.2 * k;
          lean = 0.18 * k;
        } else if (e < 1.45) fiddle(e - 0.55, 0.9);
        else hands = { kind: "idle" };
      } else if (hands.kind === "adjusting") {
        hands.t += dt;
        armSpeed = 22;
        if (hands.t < 0.8) fiddle(hands.t, 0.8);
        else hands = { kind: "idle" };
      }
      // ---- gestures: the right arm flicks a chip off its thumb, or jabs at something on the felt
      if (gesture) {
        gesture.t += dt;
        const e = gesture.t;
        armSpeed = 30;
        if (gesture.kind === "flick" && e < FLICK) {
          // cock it up and in, then snap it out towards the table
          const up = ease(e / 0.12) * (1 - ease((e - 0.12) / 0.1));
          const out = ease((e - 0.12) / 0.08) * (1 - ease((e - 0.3) / 0.15));
          armR = REST_ARM_X + (-2.05 - REST_ARM_X) * up + (-1.5 - REST_ARM_X) * out;
          zR = 0.25 - 0.3 * up - 0.15 * out;
          stretchR = 1 + 0.6 * out;
        } else if (gesture.kind === "poke" && e < POKE) {
          // reach out to the felt, squeeze twice, come back
          const k = ease(e / 0.15) * (1 - ease((e - (POKE - 0.18)) / 0.18));
          armR = REST_ARM_X + (-1.55 - REST_ARM_X) * k;
          zR = 0.25 - 0.2 * k;
          stretchR = 1 + (1.6 + Math.sin(e * 30) * 0.15) * k;
          lean = Math.max(lean, 0.1 * k);
        } else gesture = null;
      }
      const a = Math.min(1, dt * armSpeed);
      const [L, R] = arms;
      L.x += (armL - L.x) * a;
      R.x += (armR - R.x) * a;
      L.z += (zL - L.z) * a;
      R.z += (zR - R.z) * a;
      L.stretch += (stretchL - L.stretch) * a;
      R.stretch += (stretchR - R.stretch) * a;

      // ---- face layer: talking (a little extra chatter so it reads as speech) and googly pupils
      if (talkTarget > 0 && now() - talkAt > 1500) talkTarget = 0; // lost the "stopped" message
      talk += (talkTarget - talk) * Math.min(1, dt * 18);
      const mouthOpen = talk < 0.02 ? 0 : Math.min(1, talk * 1.4) * (0.45 + 0.55 * Math.abs(Math.sin(tt * 15)));
      // pupils spring toward where we're looking, with wobble
      const tx = Math.min(0.6, Math.max(-0.6, Math.sin(yaw) * 0.5));
      const ty = Math.min(0.6, Math.max(-0.6, pitch * 0.8));
      const spring = (p: ReturnType<typeof pupil>) => {
        p.vel.x += ((tx - p.off.x) * 120 - p.vel.x * 7) * dt;
        p.vel.y += ((ty - p.off.y) * 120 - p.vel.y * 7 - 6) * dt;
        p.off.x += p.vel.x * dt;
        p.off.y += p.vel.y * dt;
        const len = Math.hypot(p.off.x, p.off.y);
        if (len > 0.75) {
          p.off.x *= 0.75 / len;
          p.off.y *= 0.75 / len;
        }
        const z = Math.sqrt(Math.max(0, 1 - (p.off.x ** 2 + p.off.y ** 2)));
        return { x: p.off.x, y: p.off.y, z };
      };
      const looking: Pose["face"]["pupils"] = [spring(pupils[0]), spring(pupils[1])];

      return {
        body: { sx, sy, y, rotX: -pitch * 0.25 + lean, rotY: yaw * 0.6, rotZ },
        arms: [{ ...L }, { ...R }],
        face: { mouthOpen, eyeScale, pupils: looking },
        emote: playing,
      };
    },
  };
}
