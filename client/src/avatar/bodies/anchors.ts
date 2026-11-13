// Where things attach to a body: the head (hats stand here), eyes, mouth,
// chest, shoulders and hands, plus where the name tag and bubble float.
import type { BodyShape } from "./body.ts";

/** Where the top of a bean's head is; hats are built standing on this point. */
export const HEAD_TOP = 1.36;

/** A spot on the body: position (body space) and how much to scale what goes there. */
export interface Spot { x: number; y: number; z: number; s: number }

/** Things you can attach to a bean. Hands are animated, so they come from the rig rather than this table. */
export type AnchorId = "head" | "eyes" | "eyeL" | "eyeR" | "mouth" | "chest" | "shoulderL" | "shoulderR" | "handL" | "handR";

const spot = (x: number, y: number, z: number, s = 1): Spot => ({ x, y, z, s });

/** Every fixed anchor on a body shape, plus where its name tag and speech bubble float. */
export function anchorsFor(S: BodyShape) {
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
