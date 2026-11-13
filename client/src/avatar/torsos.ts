// The body mesh for each shape. Where things attach is in shapes.ts.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { BodyId } from "../../../shared/catalog/bodies.ts";

export const TORSOS: Record<BodyId, () => THREE.Mesh> = {
  bean: () => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.38, 8, 20)); m.position.y = 0.92; return m; },
  chonk: () => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.4, 28, 20)); m.scale.set(1.15, 0.85, 1); m.position.y = 0.86; return m; },
  noodle: () => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.78, 8, 18)); m.position.y = 1.04; return m; },
  box: () => { const m = new THREE.Mesh(new RoundedBoxGeometry(0.58, 0.74, 0.48, 4, 0.08)); m.position.y = 0.95; return m; },
  pear: () => {
    const pts = [[0, 0.5], [0.3, 0.52], [0.37, 0.63], [0.37, 0.78], [0.29, 0.97], [0.21, 1.12], [0.19, 1.24], [0.16, 1.34], [0.09, 1.41], [0, 1.43]]
      .map(([r, y]) => new THREE.Vector2(r, y));
    return new THREE.Mesh(new THREE.LatheGeometry(new THREE.SplineCurve(pts).getPoints(40), 28));
  },
};
