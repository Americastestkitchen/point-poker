// Cardboard 3D glasses: one red lens, one blue. Point estimates, now in 3D.
import * as THREE from "three";
import { mesh, toon } from "../../scene/art/materials.ts";
import type { Anchors } from "../bodies/anchors.ts";
import { lensX, LENS_Z, temples } from "./fit.ts";

const W = 0.12; // half a lens's width
const H = 0.08; // half a lens's height

/** Built on the eyes anchor. */
export function glasses3d(A: Anchors): THREE.Group {
  const g = new THREE.Group();
  const x = lensX(A, W);
  const edge = x + W + 0.035;
  // one flat card with two windows cut out
  const card = new THREE.Shape();
  card.moveTo(-edge, -H - 0.03);
  card.lineTo(-0.03, -H - 0.03);
  card.lineTo(0, -H + 0.01); // a notch for the nose
  card.lineTo(0.03, -H - 0.03);
  card.lineTo(edge, -H - 0.03);
  card.lineTo(edge, H + 0.04);
  card.lineTo(-edge, H + 0.04);
  card.closePath();
  for (const s of [-1, 1]) {
    const hole = new THREE.Path();
    hole.moveTo(s * x - W, -H);
    hole.lineTo(s * x + W, -H);
    hole.lineTo(s * x + W, H);
    hole.lineTo(s * x - W, H);
    hole.closePath();
    card.holes.push(hole);
  }
  const white = toon("#f6f3ea");
  const frame = mesh(new THREE.ExtrudeGeometry(card, { depth: 0.012, bevelEnabled: false }), white);
  frame.position.z = LENS_Z;
  g.add(frame, temples(edge - 0.01, 0.02, white));
  for (const [s, color] of [
    [-1, "#e8343c"],
    [1, "#28c8e8"],
  ] as const) {
    const lens = mesh(
      new THREE.PlaneGeometry(W * 2, H * 2),
      toon(color, { transparent: true, opacity: 0.6, depthWrite: false }),
      false,
    );
    lens.position.set(s * x, 0, LENS_Z + 0.006);
    g.add(lens);
  }
  return g;
}
