// Tall and thin, with a long way down to the tummy.
import * as THREE from "three";
import type { BodyShape } from "./body.ts";

export const noodle: BodyShape = {
  id: "noodle",
  torso() {
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.78, 8, 18));
    m.position.y = 1.04;
    return m;
  },
  eye: { x: 0.075, y: 1.42, z: 0.115, s: 0.78 },
  mouth: { y: 1.29, z: 0.166, s: 0.7 },
  chin: { y: 1.15, z: 0.17 },
  belly: { y: 0.86, z: 0.1, sx: 0.65, sy: 1.7 },
  shoulder: { x: 0.17, y: 0.98 },
  hatY: 0.25,
  hatS: 0.75,
};
