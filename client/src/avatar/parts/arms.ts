// Two rubber-hose arms hanging from the shoulders.
import * as THREE from "three";
import { mesh } from "../../scene/art/materials.ts";
import type { Pose } from "../animator.ts";
import { anchorsFor } from "../bodies/anchors.ts";
import type { BodyShape } from "../bodies/body.ts";

export interface Arms {
  readonly shoulderL: THREE.Object3D;
  readonly shoulderR: THREE.Object3D;
  readonly handL: THREE.Object3D;
  readonly handR: THREE.Object3D;
  apply(arms: Pose["arms"]): void;
}

export function buildArms(shape: BodyShape, material: THREE.Material, parent: THREE.Object3D): Arms {
  const A = anchorsFor(shape);
  function limb(spot: typeof A.shoulderL, side: -1 | 1) {
    const shoulder = new THREE.Group();
    shoulder.position.set(spot.x, spot.y, spot.z);
    const arm = mesh(new THREE.CapsuleGeometry(0.055, 0.22, 4, 10), material);
    arm.position.y = -0.14;
    const hand = mesh(new THREE.SphereGeometry(0.07, 12, 10), material);
    hand.position.y = -0.3;
    shoulder.add(arm, hand);
    shoulder.rotation.x = -1.15;
    shoulder.rotation.z = side * 0.25;
    parent.add(shoulder);
    return {
      shoulder, hand,
      apply(a: Pose["arms"][0]) {
        shoulder.rotation.x = a.x;
        shoulder.rotation.z = a.z;
        arm.scale.set(1, a.stretch, 1);
        arm.position.y = -0.14 * a.stretch;
        hand.position.y = -0.3 * a.stretch;
      },
    };
  }

  const left = limb(A.shoulderL, -1);
  const right = limb(A.shoulderR, 1);
  return {
    shoulderL: left.shoulder,
    shoulderR: right.shoulder,
    handL: left.hand,
    handR: right.hand,
    apply(arms) {
      left.apply(arms[0]);
      right.apply(arms[1]);
    },
  };
}
