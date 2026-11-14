// The pale tummy patch on the front of shapes that have one.
import * as THREE from "three";
import { mesh, toon } from "../../scene/art/materials.ts";
import type { BodyShape } from "../bodies/body.ts";

export function buildBelly(shape: BodyShape): THREE.Mesh | null {
  if (!shape.belly) return null;
  const belly = mesh(
    new THREE.SphereGeometry(0.2, 16, 12),
    toon("#ffffff", { transparent: true, opacity: 0.25 }),
    false,
  );
  belly.scale.set(shape.belly.sx, shape.belly.sy, 0.5);
  belly.position.set(0, shape.belly.y, shape.belly.z);
  return belly;
}
