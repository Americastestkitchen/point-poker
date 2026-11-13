// Body shapes as data: where the face, arms and hat sit on each one. The
// meshes come from torsos.ts; everything attaches to the anchors below.
import type { BodyId } from "../../../shared/catalog/bodies.ts";

export interface ShapeData {
  eye: { x: number; y: number; z: number; s: number };
  mouth: { y: number; z: number; s: number };
  belly: { y: number; z: number; sx: number; sy: number } | null;
  shoulder: { x: number; y: number };
  /** How far the top of the head sits above (or below) a bean's, and how big hats are on it. */
  hatY: number;
  hatS: number;
}

export const SHAPES: Record<BodyId, ShapeData> = {
  bean: {
    eye: { x: 0.105, y: 1.13, z: 0.2, s: 1 }, mouth: { y: 0.97, z: 0.255, s: 1 },
    belly: { y: 0.82, z: 0.16, sx: 1, sy: 1.1 }, shoulder: { x: 0.25, y: 0.9 }, hatY: 0, hatS: 1,
  },
  chonk: {
    eye: { x: 0.15, y: 1.03, z: 0.29, s: 1.05 }, mouth: { y: 0.89, z: 0.395, s: 1.3 },
    belly: { y: 0.74, z: 0.27, sx: 1.6, sy: 0.9 }, shoulder: { x: 0.44, y: 0.84 }, hatY: -0.15, hatS: 1.15,
  },
  noodle: {
    eye: { x: 0.075, y: 1.42, z: 0.115, s: 0.78 }, mouth: { y: 1.29, z: 0.166, s: 0.7 },
    belly: { y: 0.86, z: 0.1, sx: 0.65, sy: 1.7 }, shoulder: { x: 0.17, y: 0.98 }, hatY: 0.25, hatS: 0.75,
  },
  box: {
    eye: { x: 0.13, y: 1.12, z: 0.19, s: 1 }, mouth: { y: 0.96, z: 0.242, s: 1.2 },
    belly: null, shoulder: { x: 0.31, y: 0.92 }, hatY: -0.04, hatS: 1.1,
  },
  pear: {
    eye: { x: 0.085, y: 1.2, z: 0.13, s: 0.85 }, mouth: { y: 1.02, z: 0.262, s: 0.95 },
    belly: { y: 0.72, z: 0.24, sx: 1.4, sy: 1.0 }, shoulder: { x: 0.3, y: 0.86 }, hatY: 0.06, hatS: 0.85,
  },
};

/** Where the top of a bean's head is; hats are built standing on this point. */
export const HEAD_TOP = 1.36;

/** A spot on the body: position (body space) and how much to scale what goes there. */
export interface Spot { x: number; y: number; z: number; s: number }

/** Things you can attach to a bean. Hands are animated, so they come from the rig rather than this table. */
export type AnchorId = "head" | "eyes" | "eyeL" | "eyeR" | "mouth" | "chest" | "shoulderL" | "shoulderR" | "handL" | "handR";

const spot = (x: number, y: number, z: number, s = 1): Spot => ({ x, y, z, s });

/** Every fixed anchor on a body shape, plus where its name tag and speech bubble float. */
export function anchorsFor(body: BodyId) {
  const S = SHAPES[body];
  return {
    head: spot(0, HEAD_TOP + S.hatY, 0, S.hatS),
    eyes: spot(0, S.eye.y, S.eye.z, S.eye.s),
    eyeL: spot(-S.eye.x, S.eye.y, S.eye.z, S.eye.s),
    eyeR: spot(S.eye.x, S.eye.y, S.eye.z, S.eye.s),
    mouth: spot(0, S.mouth.y, S.mouth.z, S.mouth.s),
    /** Bow-tie height. */
    chest: spot(0, S.mouth.y - 0.13, S.mouth.z - 0.01),
    shoulderL: spot(-S.shoulder.x, S.shoulder.y, 0.02),
    shoulderR: spot(S.shoulder.x, S.shoulder.y, 0.02),
    tag: spot(0, 1.95 + Math.max(0, S.hatY), 0),
    bubble: spot(0.32 + Math.max(0, S.shoulder.x - 0.25), 1.62 + Math.max(0, S.hatY), 0),
  };
}
