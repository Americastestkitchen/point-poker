// The dealer's red bow tie. Not a choice: dealers always wear it.
import * as THREE from "three";
import { mesh, toon } from "../../scene/art/materials.ts";

/** Built centred on the chest anchor. */
export function bowtie(): THREE.Group {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const w = mesh(new THREE.ConeGeometry(0.05, 0.09, 4), toon("#b3202a"));
    w.rotation.z = s * Math.PI / 2;
    w.position.x = s * 0.045;
    g.add(w);
  }
  return g;
}
