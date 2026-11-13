// The dealer's green visor. Not a choice: dealers always wear it.
import * as THREE from "three";
import { mesh, toon } from "../../scene/art/materials.ts";

/** Built standing on the top of the head (the head anchor's origin). */
export function visor(): THREE.Group {
  const g = new THREE.Group();
  const band = mesh(new THREE.CylinderGeometry(0.265, 0.265, 0.05, 24, 1, true), toon("#163a22", { side: THREE.DoubleSide }));
  band.position.y = -0.12;
  const brim = mesh(
    new THREE.CylinderGeometry(0.42, 0.42, 0.01, 24, 1, false, -Math.PI / 2.5, (Math.PI * 2) / 2.5),
    new THREE.MeshPhysicalMaterial({ color: "#2fbf5a", transparent: true, opacity: 0.6, roughness: 0.3 }),
  );
  brim.position.set(0, -0.1, 0.0);
  brim.rotation.x = 0.25;
  g.add(band, brim);
  return g;
}
