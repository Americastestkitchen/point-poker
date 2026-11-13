// A striped party hat with a pom-pom.
import * as THREE from "three";
import { canvasTex } from "../../scene/art/textures.ts";
import { mesh, toon } from "../../scene/art/materials.ts";

/** Built standing on the top of the head (the head anchor's origin). */
export function party(): THREE.Group {
  const g = new THREE.Group();
  const tex = canvasTex(64, 64, (x) => {
    for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? "#ff5fa2" : "#4ad6ff"; x.fillRect(i * 8, 0, 8, 64); }
  });
  const c = mesh(new THREE.ConeGeometry(0.12, 0.36, 20), toon("#fff", { map: tex }));
  c.position.y = 0.14;
  c.rotation.z = 0.15;
  const pom = mesh(new THREE.SphereGeometry(0.045, 10, 8), toon("#ffd23f"));
  pom.position.set(-0.027, 0.33, 0);
  g.add(c, pom);
  return g;
}
