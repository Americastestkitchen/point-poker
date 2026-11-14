// A black sheet just in front of the camera, for moving rooms: it fades in,
// the room changes behind it (and any stutter while shaders compile is hidden),
// and it fades out on the new one.
import * as THREE from "three";
import type { Stage } from "./stage.ts";

export interface Curtain {
  /** Fades to `opacity` (1 is black) over `seconds`; resolves when it gets there. */
  to(opacity: number, seconds: number): Promise<void>;
}

export function createCurtain(stage: Pick<Stage, "camera" | "onFrame">): Curtain {
  const mat = new THREE.MeshBasicMaterial({
    color: "#000",
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
  });
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), mat);
  sheet.position.z = -0.1; // just past the camera's near plane, wider than any view
  sheet.renderOrder = 1000;
  sheet.visible = false;
  stage.camera.add(sheet);
  let target = 0;
  let speed = 1;
  let arrived: (() => void)[] = [];
  stage.onFrame((dt) => {
    const step = speed * dt;
    const o = mat.opacity;
    mat.opacity = Math.abs(target - o) <= step ? target : o + Math.sign(target - o) * step;
    sheet.visible = mat.opacity > 0;
    if (mat.opacity !== target) return;
    const done = arrived;
    arrived = [];
    for (const fn of done) fn();
  });
  return {
    to(opacity, seconds) {
      target = opacity;
      speed = Math.abs(opacity - mat.opacity) / Math.max(seconds, 1e-3);
      return new Promise((resolve) => arrived.push(resolve));
    },
  };
}
