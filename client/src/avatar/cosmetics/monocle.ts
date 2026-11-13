// A gold monocle on a chain. Very distinguished.
import * as THREE from "three";
import { mesh } from "../../scene/art/materials.ts";
import type { Anchors } from "../bodies/anchors.ts";
import { EYE_R, glass, LENS_Z, ring } from "./fit.ts";

const R = 0.13;

/** Built on the eyes anchor, over the right eye (as you look at the bean). */
export function monocle(A: Anchors): THREE.Group {
  const g = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: "#e0b040", metalness: 0.8, roughness: 0.3 });
  const x = A.eyeR.x / A.eyes.s;
  const rim = ring(R, 0.016, gold);
  rim.position.set(x, 0, LENS_Z);
  const lens = glass(R, "#ffffff", 0.18);
  lens.position.set(x, 0, LENS_Z);
  // the chain hangs from the rim's bottom in a loop and tucks into the body below the eye
  const chain = new THREE.CatmullRomCurve3([
    new THREE.Vector3(x, -R, LENS_Z),
    new THREE.Vector3(x + 0.015, -R - 0.12, LENS_Z - 0.005),
    new THREE.Vector3(x + 0.06, -R - 0.2, LENS_Z - 0.03),
    new THREE.Vector3(x + EYE_R * 0.6, -R - 0.17, -0.04),
  ]);
  g.add(rim, lens, mesh(new THREE.TubeGeometry(chain, 24, 0.006, 5), gold, false));
  return g;
}
