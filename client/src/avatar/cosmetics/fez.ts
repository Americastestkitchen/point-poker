// A fez with a tassel.
import * as THREE from "three";
import { mesh, toon } from "../../scene/art/materials.ts";

/** Built standing on the top of the head (the head anchor's origin). */
export function fez(): THREE.Group {
  const g = new THREE.Group();
  const f = mesh(new THREE.CylinderGeometry(0.11, 0.15, 0.2, 20), toon("#b3202a"));
  f.position.y = 0.04;
  const tassel = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16), toon("#111"));
  tassel.position.set(0.1, 0.08, 0);
  tassel.rotation.z = 0.5;
  g.add(f, tassel);
  return g;
}
