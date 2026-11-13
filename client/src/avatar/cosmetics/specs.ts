// Big round nerd glasses, taped up in the middle.
import * as THREE from "three";
import { mesh, toon } from "../../scene/art/materials.ts";
import type { Anchors } from "../bodies/anchors.ts";
import { bar, glass, lensX, LENS_Z, ring, temples } from "./fit.ts";

const R = 0.13;

/** Built on the eyes anchor. */
export function specs(A: Anchors): THREE.Group {
  const g = new THREE.Group();
  const frame = toon("#1c1c22");
  const x = lensX(A, R);
  for (const s of [-1, 1]) {
    const rim = ring(R, 0.02, frame);
    rim.position.set(s * x, 0, LENS_Z);
    const lens = glass(R, "#cfeaff", 0.22);
    lens.position.set(s * x, 0, LENS_Z);
    g.add(rim, lens);
  }
  g.add(bar(-(x - R), x - R, 0.02, 0.03, frame), temples(x + R, 0.02, frame));
  // the tape holding it together
  const tape = mesh(new THREE.BoxGeometry(Math.max(0.05, 2 * (x - R) + 0.03), 0.055, 0.045), toon("#f4f1e6"));
  tape.position.set(0, 0.02, LENS_Z);
  g.add(tape);
  return g;
}
