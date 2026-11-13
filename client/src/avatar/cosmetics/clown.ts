// A shiny red clown nose.
import * as THREE from "three";
import { mesh } from "../../scene/art/materials.ts";

/** Built on the nose anchor. */
export function clown(): THREE.Group {
  const g = new THREE.Group();
  const ball = mesh(
    new THREE.SphereGeometry(0.068, 20, 14),
    new THREE.MeshPhongMaterial({ color: "#e61e2a", shininess: 120, specular: "#ffffff" }),
  );
  ball.position.z = 0.045;
  g.add(ball);
  return g;
}
