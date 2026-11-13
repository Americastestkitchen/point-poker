// Pear-shaped, turned on a lathe: narrow shoulders, generous base.
import * as THREE from "three";
import type { BodyShape } from "./body.ts";

const OUTLINE = [
  [0, 0.5],
  [0.3, 0.52],
  [0.37, 0.63],
  [0.37, 0.78],
  [0.29, 0.97],
  [0.21, 1.12],
  [0.19, 1.24],
  [0.16, 1.34],
  [0.09, 1.41],
  [0, 1.43],
];

export const pear: BodyShape = {
  id: "pear",
  torso() {
    const pts = OUTLINE.map(([r, y]) => new THREE.Vector2(r, y));
    return new THREE.Mesh(new THREE.LatheGeometry(new THREE.SplineCurve(pts).getPoints(40), 28));
  },
  eye: { x: 0.085, y: 1.2, z: 0.13, s: 0.85 },
  mouth: { y: 1.02, z: 0.262, s: 0.95, tilt: 0.5 },
  chin: { y: 0.86, z: 0.33 },
  belly: { y: 0.72, z: 0.24, sx: 1.4, sy: 1.0 },
  shoulder: { x: 0.3, y: 0.86 },
  hatY: 0.06,
  hatS: 0.85,
};
