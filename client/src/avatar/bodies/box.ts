// A rounded box. No tummy: boxes don't have tummies.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { BodyShape } from "./body.ts";

export const box: BodyShape = {
  id: "box",
  torso() {
    const m = new THREE.Mesh(new RoundedBoxGeometry(0.58, 0.74, 0.48, 4, 0.08));
    m.position.y = 0.95;
    return m;
  },
  eye: { x: 0.13, y: 1.12, z: 0.19, s: 1 },
  mouth: { y: 0.96, z: 0.242, s: 1.2 },
  belly: null,
  shoulder: { x: 0.31, y: 0.92 },
  hatY: -0.04,
  hatS: 1.1,
};
