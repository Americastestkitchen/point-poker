// Every bean gets a chair; the house gets a fancier one.
import * as THREE from "three";
import { mesh, toon } from "../../scene/art/materials.ts";

export function buildChair(dealer: boolean): THREE.Group {
  const g = new THREE.Group();
  const wood = toon("#3a2216");
  const seat = mesh(new THREE.BoxGeometry(0.56, 0.06, 0.52), wood);
  seat.position.set(0, 0.5, -0.04);
  const back = mesh(new THREE.BoxGeometry(0.56, 0.7, 0.06), wood);
  back.position.set(0, 0.86, -0.3);
  back.rotation.x = -0.08;
  g.add(seat, back);
  for (const [x, z] of [[-0.24, -0.26], [0.24, -0.26], [-0.24, 0.18], [0.24, 0.18]]) {
    const leg = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.48), wood);
    leg.position.set(x, 0.24, z);
    g.add(leg);
  }
  if (dealer) {
    const crest = mesh(new THREE.TorusGeometry(0.2, 0.03, 8, 20, Math.PI), toon("#e6be5a"));
    crest.position.set(0, 1.2, -0.31);
    g.add(crest);
  }
  return g;
}
