// The rubber duck: a squeaky any room can put on its felt. Click it and it
// squeaks, hops and spins.
import * as THREE from "three";
import { toon } from "../../../scene/art/materials.ts";
import type { Prop, Squeaky } from "../../types.ts";
import { arc, oneShot } from "../animate.ts";
import { put, sphere } from "../build.ts";

/** A rubber duck. `dress` can add to it (a swim ring, a hat) before it's placed. */
export function rubberDuck(dress?: (duck: THREE.Group) => void): Prop<Squeaky> {
  return ({ sound, onFrame }) => {
    const object = new THREE.Group();
    const duck = duckModel();
    dress?.(duck);
    object.add(duck);
    const hop = oneShot(0.4);
    onFrame((dt) => {
      const left = hop.step(dt);
      if (left === null) return;
      duck.position.y = arc(left) * 0.12;
      duck.rotation.y = (1 - left) * Math.PI * 2;
      duck.scale.setScalar(1 + arc(left) * 0.15);
    });
    return {
      object,
      squeak() {
        sound.tone(1400, 0.18, "square", 0.06, 2200);
        hop.kick();
      },
    };
  };
}

function duckModel(): THREE.Group {
  const g = new THREE.Group();
  const yellow = toon("#ffd23f");
  const body = put(sphere(0.07, yellow, 16, 12), 0, 0.06, 0);
  body.scale.set(1.2, 0.85, 1);
  const head = put(sphere(0.045, yellow, 16, 12), 0.05, 0.13, 0);
  const beak = put(new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.05, 8), toon("#ff8a1c")), 0.1, 0.125, 0);
  beak.rotation.z = -Math.PI / 2;
  const tail = put(new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.05, 8), yellow), -0.085, 0.09, 0);
  tail.rotation.z = Math.PI / 2.8;
  g.add(body, head, beak, tail);
  for (const s of [-1, 1])
    g.add(put(sphere(0.009, new THREE.MeshBasicMaterial({ color: "#111" }), 8, 6), 0.08, 0.145, s * 0.025));
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  return g;
}
