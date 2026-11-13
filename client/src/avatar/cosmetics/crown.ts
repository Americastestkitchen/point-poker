// A little gold crown.
import * as THREE from "three";
import { mesh, toon } from "../../scene/materials.ts";

/** Built standing on the top of the head (the head anchor's origin). */
export function crown(): THREE.Group {
  const g = new THREE.Group();
  const ring = mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 20, 1, true), toon("#e6be5a", { side: THREE.DoubleSide }));
  ring.position.y = 0;
  g.add(ring);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const s = mesh(new THREE.ConeGeometry(0.03, 0.09, 8), toon("#e6be5a"));
    s.position.set(Math.cos(a) * 0.16, 0.08, Math.sin(a) * 0.16);
    g.add(s);
  }
  return g;
}
