// The classic: a capsule with a tummy.
import * as THREE from "three";
import type { BodyShape } from "./body.ts";

export const bean: BodyShape = {
  id: "bean",
  torso() {
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.38, 8, 20));
    m.position.y = 0.92;
    return m;
  },
  eye: { x: 0.105, y: 1.13, z: 0.2, s: 1 },
  mouth: { y: 0.97, z: 0.255, s: 1 },
  chin: { y: 0.8, z: 0.26 },
  belly: { y: 0.82, z: 0.16, sx: 1, sy: 1.1 },
  shoulder: { x: 0.25, y: 0.9 },
  hatY: 0,
  hatS: 1,
};
