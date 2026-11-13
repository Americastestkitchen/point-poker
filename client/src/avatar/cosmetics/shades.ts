// Dark sunglasses with a shine. Nobody can see where you're looking.
import * as THREE from "three";
import { mesh, toon } from "../../scene/art/materials.ts";
import type { Anchors } from "../bodies/anchors.ts";
import { bar, lensX, LENS_Z, temples } from "./fit.ts";

const R = 0.135;

/** Built on the eyes anchor. */
export function shades(A: Anchors): THREE.Group {
  const g = new THREE.Group();
  const frame = toon("#111114");
  const lens = new THREE.MeshPhongMaterial({ color: "#16161c", shininess: 90, specular: "#8899ff" });
  const shine = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.55 });
  const x = lensX(A, R);
  for (const s of [-1, 1]) {
    // a wide, slightly droopy lens
    const l = mesh(new THREE.CircleGeometry(R, 28), lens, false);
    l.scale.set(1.12, 0.8, 1);
    l.rotation.z = s * 0.12;
    l.position.set(s * x, -0.01, LENS_Z);
    const glint = mesh(new THREE.PlaneGeometry(0.02, 0.11), shine, false);
    glint.rotation.z = -0.7;
    glint.position.set(s * x - 0.04, 0.01, LENS_Z + 0.002);
    g.add(l, glint);
  }
  g.add(bar(-(x + R * 1.1), x + R * 1.1, 0.085, 0.024, frame), temples(x + R * 1.1, 0.07, frame));
  return g;
}
