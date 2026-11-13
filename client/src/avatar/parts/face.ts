// Googly eyes, and a mouth that smiles, or flaps open while you talk.
import * as THREE from "three";
import { mesh, toon } from "../../scene/art/materials.ts";
import type { Pose } from "../animator.ts";
import { anchorsFor } from "../bodies/anchors.ts";
import type { BodyShape } from "../bodies/body.ts";

export interface Face {
  readonly eyeL: THREE.Object3D;
  readonly eyeR: THREE.Object3D;
  apply(face: Pose["face"]): void;
}

export function buildFace(shape: BodyShape, parent: THREE.Object3D): Face {
  const A = anchorsFor(shape);
  function buildEye(spot: typeof A.eyeL) {
    const eye = new THREE.Group();
    eye.position.set(spot.x, spot.y, spot.z);
    eye.scale.setScalar(spot.s);
    const white = mesh(new THREE.SphereGeometry(0.115, 20, 16), toon("#ffffff"));
    const pupil = mesh(new THREE.SphereGeometry(0.052, 14, 10), new THREE.MeshBasicMaterial({ color: "#111" }), false);
    eye.add(white, pupil);
    parent.add(eye);
    return {
      eye,
      apply(scale: number, gaze: Pose["face"]["pupils"][0]) {
        eye.scale.setScalar(shape.eye.s * scale);
        pupil.position.set(gaze.x, gaze.y, gaze.z).multiplyScalar(0.08);
      },
    };
  }

  const left = buildEye(A.eyeL);
  const right = buildEye(A.eyeR);
  const { mouth } = A;
  const smile = mesh(
    new THREE.TorusGeometry(0.055, 0.013, 6, 16, Math.PI),
    new THREE.MeshBasicMaterial({ color: "#2a1414" }),
    false,
  );
  smile.position.set(mouth.x, mouth.y, mouth.z);
  smile.scale.setScalar(mouth.s);
  smile.rotation.z = Math.PI;
  parent.add(smile);
  // open mouth for talking: a dark oval with a little tongue
  const hole = mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: "#2a1414" }), false);
  const tongue = mesh(new THREE.SphereGeometry(0.55, 12, 8), new THREE.MeshBasicMaterial({ color: "#d9566a" }), false);
  tongue.position.set(0, -0.45, 0.35);
  tongue.scale.set(1, 0.6, 0.5);
  hole.add(tongue);
  hole.position.set(0, mouth.y - 0.025 * mouth.s, mouth.z - 0.003);
  hole.scale.set(0.05, 0.001, 0.025);
  hole.visible = false;
  parent.add(hole);

  return {
    eyeL: left.eye,
    eyeR: right.eye,
    apply(face) {
      left.apply(face.eyeScale, face.pupils[0]);
      right.apply(face.eyeScale, face.pupils[1]);
      hole.visible = face.mouthOpen > 0.03;
      smile.visible = !hole.visible;
      hole.scale.set((0.05 + face.mouthOpen * 0.02) * mouth.s, (0.016 + face.mouthOpen * 0.07) * mouth.s, 0.03);
    },
  };
}
