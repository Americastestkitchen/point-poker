// A waxed handlebar moustache with curly tips. Wiggles when you talk.
import * as THREE from "three";
import { mesh, toon } from "../../scene/art/materials.ts";
import { talks } from "./talk.ts";

/** Built on the mouth anchor, sitting just above the mouth. */
export function handlebar(): THREE.Group {
  const g = new THREE.Group();
  const tache = talks(new THREE.Group(), { lift: 0.012, wobble: 0.18 });
  tache.position.set(0, 0.04, 0.012);
  const hair = toon("#3b2416");
  for (const s of [-1, 1]) {
    const side = mesh(new THREE.SphereGeometry(1, 14, 10), hair);
    side.scale.set(0.075, 0.03, 0.028);
    side.rotation.z = s * 0.25;
    side.position.set(s * 0.06, -0.005, 0);
    // the waxed tip curls up and back in
    const curl = mesh(new THREE.TorusGeometry(0.026, 0.009, 6, 14, Math.PI * 1.4), hair);
    curl.position.set(s * 0.14, 0.025, -0.012);
    curl.rotation.set(0, 0, s > 0 ? -Math.PI / 2 : Math.PI * 0.1);
    curl.scale.x = s;
    tache.add(side, curl);
  }
  g.add(tache);
  return g;
}
