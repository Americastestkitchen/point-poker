// Your eyes: the camera sits behind your seat and you drag to look around.
// Where you look is shared (throttled) so your bean turns its head for others.
import * as THREE from "three";
import type { Layout } from "../layout/layout.ts";

export function createCameraRig(
  camera: THREE.PerspectiveCamera,
  layout: Layout,
  onGaze: (yaw: number, pitch: number) => void,
) {
  const pos = new THREE.Vector3(0, 1.3, 3);
  const target = new THREE.Vector3(0, 1.3, 3);
  const view = { yaw: 0, pitch: 0, sentYaw: 0, sentPitch: 0 };
  const { lookAt: l } = layout.cameras;
  const lookAt = new THREE.Vector3(l.x, l.y, l.z);
  const d = new THREE.Vector3();
  let gazeTimer = 0;

  return {
    /** Sit behind the seat at (x, z). `snap` skips the glide (first view of the table). */
    seat(x: number, z: number, dealer: boolean, snap: boolean) {
      const p = layout.cameras.seat(x, z, dealer);
      target.set(p.x, p.y, p.z);
      if (snap) pos.copy(target);
    },
    drag(dx: number, dy: number) {
      view.yaw = THREE.MathUtils.clamp(view.yaw - dx * 0.003, -1.9, 1.9);
      view.pitch = THREE.MathUtils.clamp(view.pitch - dy * 0.00225, -0.55, 0.9);
    },
    recenter() {
      view.yaw = 0;
      view.pitch = 0;
    },
    update(dt: number) {
      pos.lerp(target, Math.min(1, dt * 3));
      camera.position.copy(pos);
      d.copy(lookAt).sub(pos);
      const baseYaw = Math.atan2(-d.x, -d.z);
      const basePitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
      camera.rotation.set(basePitch - view.pitch, baseYaw - view.yaw, 0, "YXZ");
      gazeTimer += dt;
      if (
        gazeTimer > 0.1 &&
        (Math.abs(view.yaw - view.sentYaw) > 0.01 || Math.abs(view.pitch - view.sentPitch) > 0.01)
      ) {
        gazeTimer = 0;
        view.sentYaw = view.yaw;
        view.sentPitch = view.pitch;
        onGaze(-view.yaw, -view.pitch);
      }
    },
  };
}

export type CameraRig = ReturnType<typeof createCameraRig>;
