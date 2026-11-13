// What a body shape is: its mesh, and where the face, arms and hat go on it.
// One file per shape in this folder; a new shape is a new file here plus an
// entry in shared/catalog/bodies.ts (its id, label and icon).
import type * as THREE from "three";
import type { BodyId } from "../../../../shared/catalog/bodies.ts";

export interface BodyShape {
  readonly id: BodyId;
  /** The body mesh; the rig gives it the bean's material. */
  torso(): THREE.Mesh;
  readonly eye: { x: number; y: number; z: number; s: number };
  readonly mouth: { y: number; z: number; s: number };
  /** The pale tummy patch, if this shape has one. */
  readonly belly: { y: number; z: number; sx: number; sy: number } | null;
  readonly shoulder: { x: number; y: number };
  /** How far the top of the head sits above (or below) a bean's, and how big hats are on it. */
  readonly hatY: number;
  readonly hatS: number;
}
