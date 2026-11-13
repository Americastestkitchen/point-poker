// A traffic cone, worn with pride.
import * as THREE from "three";
import { mesh, toon } from "../../scene/art/materials.ts";

/** Built standing on the top of the head (the head anchor's origin). */
export function cone(): THREE.Group {
  const g = new THREE.Group();
  const base = mesh(new THREE.BoxGeometry(0.36, 0.03, 0.36), toon("#ff6a13"));
  base.position.y = -0.04;
  const c = mesh(new THREE.ConeGeometry(0.15, 0.45, 20), toon("#ff6a13"));
  c.position.y = 0.2;
  const stripe = mesh(new THREE.CylinderGeometry(0.085, 0.11, 0.08, 20), toon("#ffffff"));
  stripe.position.y = 0.22;
  g.add(base, c, stripe);
  return g;
}
