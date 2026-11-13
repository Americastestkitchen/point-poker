// A big bushy beard from ear to ear. It drops with your jaw when you talk.
import * as THREE from "three";
import { mesh, toon } from "../../scene/art/materials.ts";
import type { Anchors } from "../bodies/anchors.ts";
import { relative } from "./fit.ts";
import { talks } from "./talk.ts";

/** Built on the mouth anchor: the moustache sits above the mouth, the beard hangs on the chin. */
export function beard(A: Anchors): THREE.Group {
  const g = new THREE.Group();
  const hair = toon("#6b3f1f");
  const fluff = (x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
    const m = mesh(new THREE.SphereGeometry(1, 14, 10), hair);
    m.scale.set(sx, sy, sz);
    m.position.set(x, y, z);
    return m;
  };
  const chin = relative(A, "mouth", "chin");
  const jaw = talks(new THREE.Group(), { lift: -0.04, wobble: 0.05 });
  jaw.position.set(0, chin.y, chin.z);
  // the bulk on the chin, a point below it, and a tuft up each cheek
  jaw.add(
    fluff(0, 0, -0.05, 0.2, 0.16, 0.11),
    fluff(0, -0.1, -0.04, 0.13, 0.1, 0.09),
    fluff(-0.13, 0.08, -0.07, 0.1, 0.12, 0.09),
    fluff(0.13, 0.08, -0.07, 0.1, 0.12, 0.09),
  );
  const tache = talks(new THREE.Group(), { lift: 0.01, wobble: 0.08 });
  tache.position.set(0, 0.035, 0.008);
  for (const s of [-1, 1]) tache.add(fluff(s * 0.05, 0, 0, 0.065, 0.028, 0.026));
  g.add(jaw, tache);
  return g;
}
