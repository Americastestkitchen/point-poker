// What a body shape is: its mesh, and where the face, arms and hat go on it.
// Add each shape here, in BODY_SHAPES in index.ts, and in
// shared/catalog/bodies.ts (its id, label and icon).
import type * as THREE from "three";
import type { BodyId } from "../../../../shared/catalog/bodies.ts";

export interface BodyShape {
  readonly id: BodyId;
  /** The body mesh; the rig gives it the bean's material. */
  torso(): THREE.Mesh;
  readonly eye: { x: number; y: number; z: number; s: number };
  /** `tilt` leans the mouth back (radians) to lie flush where the face slopes outwards below it. */
  readonly mouth: { y: number; z: number; s: number; tilt: number };
  /** The front of the body a little below the mouth, where a beard hangs. */
  readonly chin: { y: number; z: number };
  /** The pale tummy patch, if this shape has one. */
  readonly belly: { y: number; z: number; sx: number; sy: number } | null;
  readonly shoulder: { x: number; y: number };
  /** How far the top of the head sits above (or below) a bean's, and how big hats are on it. */
  readonly hatY: number;
  readonly hatS: number;
}
