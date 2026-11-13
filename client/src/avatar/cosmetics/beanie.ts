// A propeller beanie. The propeller (named "spin") turns.
import * as THREE from "three";
import { mesh, toon } from "../../scene/art/materials.ts";

/** Built standing on the top of the head (the head anchor's origin). */
export function beanie(): THREE.Group {
  const g = new THREE.Group();
  const cap = mesh(new THREE.SphereGeometry(0.25, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), toon("#3b7dd8"));
  cap.position.y = -0.12;
  g.add(cap);
  const stick = mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.1), toon("#ddd"));
  stick.position.y = 0.16;
  g.add(stick);
  const prop = new THREE.Group();
  prop.name = "spin";
  prop.position.y = 0.21;
  for (const [c, r] of [["#ff4757", 0], ["#ffd23f", Math.PI]] as const) {
    const b = mesh(new THREE.BoxGeometry(0.18, 0.01, 0.05), toon(c));
    b.position.x = 0.09;
    const piv = new THREE.Group();
    piv.rotation.y = r;
    piv.add(b);
    prop.add(piv);
  }
  g.add(prop);
  return g;
}
