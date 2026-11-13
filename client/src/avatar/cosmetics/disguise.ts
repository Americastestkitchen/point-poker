// The classic disguise: thick glasses, bushy eyebrows and a big pink nose, all
// one piece. Fills the eyewear and nose slots.
import * as THREE from "three";
import { mesh, toon } from "../../scene/art/materials.ts";
import type { Anchors } from "../bodies/anchors.ts";
import { bar, relative, lensX, LENS_Z, ring, temples } from "./fit.ts";
import { talks } from "./talk.ts";

const R = 0.12;

/** Built on the eyes anchor; the nose reaches down to where the nose anchor is. */
export function disguise(A: Anchors): THREE.Group {
  const g = new THREE.Group();
  const frame = toon("#141414");
  const x = lensX(A, R);
  for (const s of [-1, 1]) {
    const rim = ring(R, 0.026, frame);
    rim.position.set(s * x, 0, LENS_Z);
    // a bushy brow, which bounces when you talk
    const brow = mesh(new THREE.CapsuleGeometry(0.035, 0.15, 4, 10), frame);
    brow.rotation.z = Math.PI / 2 + s * 0.18;
    brow.position.set(s * x, R + 0.05, LENS_Z + 0.01);
    g.add(rim, talks(brow, { lift: 0.03, wobble: 0.25 }));
  }
  g.add(bar(-(x - R), x - R, 0.01, 0.035, frame), temples(x + R, 0.01, frame));
  const at = relative(A, "eyes", "nose");
  const skin = toon("#f2a093");
  const nose = new THREE.Group();
  nose.position.set(0, at.y, at.z);
  nose.scale.setScalar(at.s);
  const bridge = mesh(new THREE.CapsuleGeometry(0.045, 0.1, 4, 12), skin);
  bridge.rotation.x = 0.5;
  bridge.position.set(0, 0.05, 0.06);
  const tip = mesh(new THREE.SphereGeometry(0.075, 16, 12), skin);
  tip.position.set(0, -0.01, 0.11);
  nose.add(bridge, tip);
  g.add(nose);
  return g;
}
