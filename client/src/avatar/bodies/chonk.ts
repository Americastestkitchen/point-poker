// A squashed ball: wide, low and proud of it.
import * as THREE from "three";
import type { BodyShape } from "./body.ts";

export const chonk: BodyShape = {
  id: "chonk",
  torso() {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.4, 28, 20));
    m.scale.set(1.15, 0.85, 1);
    m.position.y = 0.86;
    return m;
  },
  eye: { x: 0.15, y: 1.03, z: 0.29, s: 1.05 },
  mouth: { y: 0.89, z: 0.395, s: 1.3, tilt: 0 },
  chin: { y: 0.71, z: 0.35 },
  belly: { y: 0.74, z: 0.27, sx: 1.6, sy: 0.9 },
  shoulder: { x: 0.44, y: 0.84 },
  hatY: -0.15,
  hatS: 1.15,
};
