// Everything a bean does, as numbers: breathing, emotes, getting bonked,
// celebrating, putting a card down, swapping it after the reveal, using a hand item on someone
// (pointing, a hammer, a coin, a paper plane, a spitball) and taking one, poking the duck, talking
// and looking around. It has three layers (body, arms, face) and produces a
// Pose; the rig turns that into meshes. No three.js here, so the same animator
// drives the bean and your first-person body, and tests can run it.
import { isEmote, type EmoteId } from "../../../shared/catalog/emotes.ts";

export type ClipId = EmoteId | Reaction | "celebrate" | "placeCard" | "adjustCard" | "swapCard" | Gesture;

/**
 * Taking a hit: `bonked` by a coin, `bopped` (softly) by a paper plane, `squashed` flat by the
 * hammer and left seeing stars, `splatted` by a spitball, or `noticed` that someone's pointing.
 */
type Reaction = "bonked" | "bopped" | "squashed" | "splatted" | "noticed";

/**
 * A quick move of the right arm that wins over everything else for a moment. All but the poke
 * are aimed at someone (see `setAim`): pointing, swinging the hammer, flicking a coin, throwing
 * a paper plane, and blowing a spitball through a straw.
 */
export type Gesture = "flick" | "poke" | "point" | "bonk" | "throw" | "blow";

/** What a gesture puts in the hand for a moment (the straw goes in the mouth; the finger is the hand's own). */
export type Prop = "finger" | "coin" | "hammer" | "plane" | "straw";

/** Where the right arm aims: the shoulder angles that point it at someone, and the stretch that reaches them. */
export interface Aim {
  x: number;
  z: number;
  reach: number;
}

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
  /** What's in the right hand (or, for the straw, the mouth) right now. */
  prop: Prop | null;
  /** Seconds of seeing stars left after a hammer blow; 0 when the head is clear. */
  dizzy: number;
}

const REST_ARM_X = -1.15;
/** How long putting a card down takes, and when the hand pats it (seconds). */
const PLACE = 1.05;
export const PLACE_PAT = 0.65;
/**
 * Changing your card after the reveal: the hand grabs the old card off the felt, hoists it up
 * and slaps the new one down. When it grabs and when it slaps (seconds), and how long it all takes.
 */
export const SWAP_GRAB = 0.28,
  SWAP_SLAP = 0.72;
const SWAP = 1.15;
/** How long a flick and a poke take (seconds). */
const FLICK = 0.5,
  POKE = 0.6;
/** When the coin leaves the thumb. */
export const FLICK_RELEASE = 0.16;
/** How long a bean keeps pointing, and how much of the way over to them the arm goes. */
export const POINT = 2.6;
const POINT_REACH = 0.4;
/** The hammer: the arm stretches out raised, then comes down on their head at BONK_HIT. */
const BONK = 1.0;
export const BONK_HIT = 0.42;
/** The paper plane leaves the hand at THROW_RELEASE; the spitball leaves the straw at BLOW_RELEASE. */
const THROW = 0.7;
export const THROW_RELEASE = 0.3;
const BLOW = 0.95;
export const BLOW_RELEASE = 0.42;
/** How long the stars circle after a hammer blow. */
export const DIZZY = 2.4;
/** Aimed straight ahead at the felt, for a gesture nobody aimed. */
const AHEAD: Aim = { x: -1.5, z: 0.1, reach: 1.6 };
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
  /** Where the aimed gestures point. The rig works it out from who's being pointed at, every frame. */
  setAim(aim: Aim): void;
  /** An aimed gesture is going on, so the aim is worth keeping up to date. */
  readonly aiming: boolean;
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
  /** Flattened by the hammer: seconds since it landed, or -1. */
  let squashT = -1;
  let dizzy = 0;
  /** A start: how wide the eyes go and how far the body rocks back, fading out. */
  let startle = { t: 0, eyes: 0, rock: 0 };
  let aim = AHEAD;
  /** The emote playing, and how many seconds in. */
  let emote: { id: EmoteId; t: number } | null = null;
  /** What the hands are doing with the card, and how many seconds in. */
  let hands:
    | { kind: "idle" }
    | { kind: "placing"; t: number }
    | { kind: "adjusting"; t: number }
    | { kind: "swapping"; t: number } = { kind: "idle" };
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
        case "bopped":
          bonkT = clip === "bonked" ? 1 : 0.5;
          for (const p of pupils) {
            p.vel.x = (random() - 0.5) * 40 * bonkT;
            p.vel.y = (random() - 0.5) * 40 * bonkT;
          }
          return;
        case "squashed":
          squashT = 0;
          dizzy = DIZZY;
          return;
        case "splatted":
          startle = { t: 0.7, eyes: 0.3, rock: 0.22 };
          return;
        case "noticed":
          startle = { t: 0.5, eyes: 0.18, rock: 0 };
          return;
        case "celebrate":
          celebrateT = 2.2;
          return;
        case "placeCard":
          hands = { kind: "placing", t: 0 };
          return;
        case "adjustCard":
          // squaring it up waits until it's been put down
          if (hands.kind !== "placing" && hands.kind !== "swapping") hands = { kind: "adjusting", t: 0 };
          return;
        case "swapCard":
          hands = { kind: "swapping", t: 0 };
          return;
        case "flick":
        case "poke":
        case "point":
        case "bonk":
        case "throw":
        case "blow":
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

    setAim(next) {
      aim = next;
    },

    get aiming() {
      return gesture !== null && gesture.kind !== "poke";
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
      if (squashT >= 0) {
        // flat as a pancake in a blink, a beat to take it in, then it springs back up with a wobble
        squashT += dt;
        const e = squashT;
        const flat = ease(e / 0.07) * (1 - ease((e - 0.45) / 0.25));
        const spring = e > 0.45 ? Math.sin((e - 0.45) * 16) * Math.exp(-(e - 0.45) * 4.5) * 0.22 : 0;
        sy -= 0.42 * flat - spring;
        sx += 0.34 * flat - spring * 0.6;
        if (e > 1.8) squashT = -1;
      }
      if (celebrateT > 0) {
        celebrateT = Math.max(0, celebrateT - dt);
        y = Math.abs(Math.sin(celebrateT * 7)) * 0.18 * Math.min(1, celebrateT);
      }
      let rotZ = 0;
      let eyeScale = 1;
      let rock = 0;
      if (startle.t > 0) {
        startle.t = Math.max(0, startle.t - dt);
        const k = Math.min(1, startle.t * 4);
        eyeScale += startle.eyes * k;
        rock = startle.rock * k;
      }
      if (dizzy > 0) {
        // seeing stars: the head lolls round and the pupils go for a spin
        dizzy = Math.max(0, dizzy - dt);
        const k = Math.min(1, dizzy);
        rotZ += Math.sin(tt * 5) * 0.09 * k;
        for (const [i, p] of pupils.entries()) {
          p.vel.x += Math.cos(tt * 11 + i * 2) * 260 * k * dt;
          p.vel.y += Math.sin(tt * 11 + i * 2) * 260 * k * dt;
        }
      }
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
          rotZ += Math.sin(e * 30) * 0.06;
          y += Math.abs(Math.sin(e * 20)) * 0.04;
        }
        if (id === "think") {
          rotZ += 0.2 * Math.min(1, e * 4);
          armL = -2.4;
        }
        if (e > 2) emote = null;
        else {
          if (id === "shock") {
            y += Math.max(0, 0.15 - e * 0.4);
            eyeScale = 1.3;
          }
          playing = { id, t: e };
        }
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
        if (e < PLACE) {
          // one move: the right arm swings forward and stretches out to the felt, pats the card
          // down once it's landed, and comes back
          const k = ease(e / 0.32) * (1 - ease((e - (PLACE - 0.3)) / 0.3));
          const pat = Math.sin(Math.min(1, Math.max(0, (e - 0.55) / 0.2)) * Math.PI);
          armR = REST_ARM_X + (-1.58 - REST_ARM_X) * k + 0.12 * pat;
          stretchR = 1 + 1.5 * k;
          zR = 0.25 - 0.2 * k;
          lean = 0.18 * k;
        } else hands = { kind: "idle" };
      } else if (hands.kind === "adjusting") {
        hands.t += dt;
        armSpeed = 22;
        if (hands.t < 0.8) fiddle(hands.t, 0.8);
        else hands = { kind: "idle" };
      } else if (hands.kind === "swapping") {
        hands.t += dt;
        const e = hands.t;
        armSpeed = 26;
        if (e < SWAP) {
          // reach out to the felt and grab the card, hoist it up over the head for a big wind-up,
          // then SLAP the new one down with the whole body behind it, and settle back
          const reach = ease(e / SWAP_GRAB) * (1 - ease((e - SWAP_GRAB) / 0.12));
          const hoist = ease((e - SWAP_GRAB) / 0.22) * (1 - ease((e - (SWAP_SLAP - 0.1)) / 0.1));
          const slam = ease((e - (SWAP_SLAP - 0.1)) / 0.1) * (1 - ease((e - (SWAP - 0.3)) / 0.3));
          armR = REST_ARM_X + (-1.58 - REST_ARM_X) * reach + (-2.6 - REST_ARM_X) * hoist + (-1.55 - REST_ARM_X) * slam;
          stretchR = 1 + 1.5 * reach + 0.35 * hoist + 1.45 * slam;
          zR = 0.25 - 0.2 * reach + 0.1 * hoist - 0.2 * slam;
          lean = 0.16 * reach - 0.08 * hoist + 0.24 * slam;
        } else hands = { kind: "idle" };
      }
      // ---- gestures: the right arm uses a hand item on someone, or jabs at something on the felt
      let prop: Prop | null = null;
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
          if (e < FLICK_RELEASE) prop = "coin";
        } else if (gesture.kind === "point" && e < POINT) {
          // out it goes, part of the way over to them, with a couple of jabs; it stays on them, and comes back
          const k = ease(e / 0.18) * (1 - ease((e - (POINT - 0.3)) / 0.3));
          const jab = Math.sin(e * 15) * Math.exp(-e * 3.5);
          armR = REST_ARM_X + (aim.x - REST_ARM_X) * k;
          zR = 0.25 + (aim.z - 0.25) * k;
          stretchR = 1 + (aim.reach * POINT_REACH - 1) * (1 + 0.25 * jab) * k;
          lean = Math.max(lean, 0.08 * k);
          prop = "finger";
        } else if (gesture.kind === "bonk" && e < BONK) {
          // the rubber arm stretches all the way over to them with the hammer held high, then
          // comes down on their head, rests there a beat, and snaps back
          const out = ease(e / 0.26) * (1 - ease((e - 0.62) / 0.3));
          const up = ease(e / 0.26) * (1 - ease((e - 0.3) / 0.1));
          const down = ease((e - 0.3) / 0.1) * (1 - ease((e - 0.62) / 0.3));
          armR = REST_ARM_X + (aim.x - 0.65 - REST_ARM_X) * up + (aim.x + 0.03 - REST_ARM_X) * down;
          zR = 0.25 + (aim.z - 0.25) * out;
          stretchR = 1 + (aim.reach - 1) * (0.85 * up + down);
          lean = Math.max(lean, 0.22 * down - 0.1 * up);
          if (e < BONK - 0.1) prop = "hammer";
        } else if (gesture.kind === "throw" && e < THROW) {
          // back past the ear, then forward at them, letting go on the way
          const back = ease(e / 0.2) * (1 - ease((e - 0.2) / 0.1));
          const fwd = ease((e - 0.2) / 0.1) * (1 - ease((e - 0.42) / 0.28));
          armR = REST_ARM_X + (-2.75 - REST_ARM_X) * back + (aim.x - REST_ARM_X) * fwd;
          zR = 0.25 + (aim.z - 0.25) * (back + fwd);
          stretchR = 1 + 0.15 * back + 0.7 * fwd;
          lean = Math.max(lean, 0.16 * fwd - 0.08 * back);
          if (e < THROW_RELEASE) prop = "plane";
        } else if (gesture.kind === "blow" && e < BLOW) {
          // the hand comes up to hold the straw; a deep breath in, and the puff knocks them back a little
          const k = ease(e / 0.16) * (1 - ease((e - (BLOW - 0.25)) / 0.25));
          const puff = Math.max(0, 1 - Math.abs(e - BLOW_RELEASE) / 0.12);
          armR = REST_ARM_X + (-2.25 - REST_ARM_X) * k;
          zR = 0.25 - 0.62 * k;
          stretchR = 1 - 0.08 * k;
          lean = Math.max(lean, -0.1 * ease(e / BLOW_RELEASE) * k + 0.24 * puff);
          sx += 0.07 * ease(e / BLOW_RELEASE) * k * (1 - puff);
          prop = "straw";
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
        body: { sx, sy, y, rotX: -pitch * 0.25 + lean - rock, rotY: yaw * 0.6, rotZ },
        arms: [{ ...L }, { ...R }],
        face: { mouthOpen, eyeScale, pupils: looking },
        emote: playing,
        prop,
        dizzy,
      };
    },
  };
}
