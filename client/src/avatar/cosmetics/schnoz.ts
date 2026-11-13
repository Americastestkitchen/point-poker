// A huge bulbous honker with nostrils.
import * as THREE from "three";
import { mesh, toon } from "../../scene/art/materials.ts";

/** Built on the nose anchor. */
export function schnoz(): THREE.Group {
  const g = new THREE.Group();
  const skin = toon("#f0a58f");
  const bridge = mesh(new THREE.CapsuleGeometry(0.045, 0.1, 4, 12), skin);
  bridge.rotation.x = 0.7;
  bridge.position.set(0, 0.04, 0.05);
  const bulb = mesh(new THREE.SphereGeometry(0.085, 18, 14), skin);
  bulb.scale.set(1, 0.9, 1.05);
  bulb.position.set(0, -0.025, 0.12);
  g.add(bridge, bulb);
  const dark = new THREE.MeshBasicMaterial({ color: "#5a2320" });
  for (const s of [-1, 1]) {
    const nostril = mesh(new THREE.SphereGeometry(0.018, 8, 6), dark, false);
    nostril.scale.set(1, 0.6, 1);
    nostril.position.set(s * 0.032, -0.09, 0.13);
    g.add(nostril);
  }
  return g;
}
