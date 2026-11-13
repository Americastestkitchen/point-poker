// A puffy chef's toque.
import * as THREE from "three";
import { mesh, toon } from "../../scene/art/materials.ts";

/** Built standing on the top of the head (the head anchor's origin). */
export function chef(): THREE.Group {
  const g = new THREE.Group();
  const band = mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.16, 20), toon("#ffffff"));
  band.position.y = 0.02;
  g.add(band);
  for (let i = 0; i < 5; i++) {
    const puff = mesh(new THREE.SphereGeometry(0.1, 12, 10), toon("#ffffff"));
    const a = (i / 5) * Math.PI * 2;
    puff.position.set(Math.cos(a) * 0.09, 0.15, Math.sin(a) * 0.09);
    g.add(puff);
  }
  const mid = mesh(new THREE.SphereGeometry(0.12, 12, 10), toon("#ffffff"));
  mid.position.y = 0.2;
  g.add(mid);
  return g;
}
