// A huge droopy walrus moustache that hides the mouth, and flaps when you talk.
import * as THREE from "three";
import { mesh, toon } from "../../scene/art/materials.ts";
import { talks } from "./talk.ts";

/** Built on the mouth anchor, hanging over the mouth. */
export function walrus(): THREE.Group {
  const g = new THREE.Group();
  const tache = talks(new THREE.Group(), { lift: 0.025, wobble: 0.1 });
  tache.position.set(0, 0.03, 0.02);
  const hair = toon("#8a6a4a");
  // a row of bushy tufts, drooping more towards the ends
  for (let i = -3; i <= 3; i++) {
    const tuft = mesh(new THREE.SphereGeometry(1, 12, 10), hair);
    const out = Math.abs(i) / 3;
    tuft.scale.set(0.04, 0.06 + out * 0.025, 0.03);
    tuft.position.set(i * 0.035, -0.02 - out * out * 0.05, -out * 0.03);
    tuft.rotation.z = -i * 0.12;
    tache.add(tuft);
  }
  g.add(tache);
  return g;
}
