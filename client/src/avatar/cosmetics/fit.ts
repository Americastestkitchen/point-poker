// Shared bits for face items: where the lenses go on this body's eyes, where
// other anchors are from an item's own, and the pieces glasses are made of. Eyewear is built in the eyes anchor's space, so
// one unit there is one unit of eye.
import * as THREE from "three";
import { mesh, toon } from "../../scene/art/materials.ts";
import type { Anchors } from "../bodies/anchors.ts";

/** How big a googly eye is, in the eyes anchor's units (see parts/face.ts). */
export const EYE_R = 0.115;
/** How far in front of the eyes' centres lenses sit: just past the eyeballs. */
export const LENS_Z = EYE_R + 0.015;

/**
 * Where each lens is centred, left and right of the middle. Lenses sit on the
 * eyes, but never so close that the two would overlap.
 */
export function lensX(A: Anchors, radius: number): number {
  return Math.max(A.eyeR.x / A.eyes.s, radius + 0.014);
}

/**
 * Where another anchor is in the space of the one an item is built on, for items
 * that reach across the face: a disguise's nose, a beard's chin.
 */
export function relative(A: Anchors, from: "eyes" | "mouth", to: "nose" | "chin") {
  const s = A[from].s;
  return { y: (A[to].y - A[from].y) / s, z: (A[to].z - A[from].z) / s, s: A[to].s / s };
}

/** A round rim, facing forward. */
export function ring(radius: number, tube: number, material: THREE.Material): THREE.Mesh {
  return mesh(new THREE.TorusGeometry(radius, tube, 8, 28), material);
}

/** A see-through lens, facing forward. */
export function glass(radius: number, color: THREE.ColorRepresentation, opacity: number): THREE.Mesh {
  return mesh(
    new THREE.CircleGeometry(radius, 28),
    toon(color, { transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide }),
    false,
  );
}

/** The arms that run back over the ears (into the body, where nobody sees them). */
export function temples(x: number, y: number, material: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const arm = mesh(new THREE.BoxGeometry(0.016, 0.016, 0.26), material);
    arm.position.set(s * x, y, LENS_Z - 0.13);
    g.add(arm);
  }
  return g;
}

/** A plain bar from (x1, y) to (x2, y), for bridges and brows. */
export function bar(x1: number, x2: number, y: number, thick: number, material: THREE.Material): THREE.Mesh {
  const m = mesh(new THREE.BoxGeometry(Math.abs(x2 - x1), thick, thick), material);
  m.position.set((x1 + x2) / 2, y, LENS_Z);
  return m;
}
