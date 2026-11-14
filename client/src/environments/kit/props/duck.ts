// The rubber duck: a squeaky any room can put on its felt. Click it and it
// squeaks, hops and spins.
import * as THREE from "three";
import { toon } from "../../../scene/art/materials.ts";
import type { Prop, Squeaky } from "../../types.ts";

/** A rubber duck. `dress` can add to it (a swim ring, a hat) before it's placed. */
export function rubberDuck(dress?: (duck: THREE.Group) => void): Prop<Squeaky> {
  return ({ sound, onFrame }) => {
    const object = new THREE.Group();
    const duck = duckModel();
    dress?.(duck);
    object.add(duck);
    let hop = 0;
    onFrame((dt) => {
      if (hop <= 0) return;
      hop = Math.max(0, hop - dt * 2.5);
      duck.position.y = Math.sin(hop * Math.PI) * 0.12;
      duck.rotation.y = (1 - hop) * Math.PI * 2;
      duck.scale.setScalar(1 + Math.sin(hop * Math.PI) * 0.15);
    });
    return {
      object,
      squeak() {
        sound.tone(1400, 0.18, "square", 0.06, 2200);
        hop = 1;
      },
    };
  };
}

function duckModel(): THREE.Group {
  const g = new THREE.Group();
  const yellow = toon("#ffd23f");
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), yellow);
  body.scale.set(1.2, 0.85, 1);
  body.position.y = 0.06;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), yellow);
  head.position.set(0.05, 0.13, 0);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.05, 8), toon("#ff8a1c"));
  beak.rotation.z = -Math.PI / 2;
  beak.position.set(0.1, 0.125, 0);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.05, 8), yellow);
  tail.rotation.z = Math.PI / 2.8;
  tail.position.set(-0.085, 0.09, 0);
  g.add(body, head, beak, tail);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 6), new THREE.MeshBasicMaterial({ color: "#111" }));
    eye.position.set(0.08, 0.145, s * 0.025);
    g.add(eye);
  }
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  return g;
}
