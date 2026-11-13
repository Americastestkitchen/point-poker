// A tall black top hat with a red band.
import * as THREE from "three";
import { mesh, toon } from "../../scene/art/materials.ts";

/** Built standing on the top of the head (the head anchor's origin). */
export function tophat(): THREE.Group {
  const g = new THREE.Group();
  const brim = mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.02, 24), toon("#1a1a1a"));
  brim.position.y = -0.04;
  const crown = mesh(new THREE.CylinderGeometry(0.17, 0.18, 0.32, 24), toon("#1a1a1a"));
  crown.position.y = 0.12;
  const band = mesh(new THREE.CylinderGeometry(0.182, 0.182, 0.05, 24), toon("#b23a2e"));
  band.position.y = 0;
  g.add(brim, crown, band);
  return g;
}
