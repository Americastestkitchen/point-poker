// A viking helmet with horns.
import * as THREE from "three";
import { mesh, toon } from "../../scene/art/materials.ts";

/** Built standing on the top of the head (the head anchor's origin). */
export function horns(): THREE.Group {
  const g = new THREE.Group();
  const helm = mesh(new THREE.SphereGeometry(0.265, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2.4), toon("#8a8f98"));
  helm.position.y = -0.14;
  g.add(helm);
  for (const s of [-1, 1]) {
    const h = mesh(new THREE.ConeGeometry(0.05, 0.25, 12), toon("#efe4c8"));
    h.position.set(s * 0.26, 0.02, 0);
    h.rotation.z = -s * 0.9;
    g.add(h);
  }
  return g;
}
