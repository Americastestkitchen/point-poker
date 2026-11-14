// Your eyes: the camera sits behind your seat and you drag to look around.
// Where you look is shared (throttled) so your bean turns its head for others.
// Until you sit down it drifts slowly round the room for the title screens instead.
import * as THREE from "three";
import type { Layout } from "../layout/layout.ts";

/** How long being flattened lasts, down and back up (seconds). */
const FLAT = 1.6;
const ease = (x: number) => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
};

/** How far your eyes are below where they belong, `e` seconds after a hammer landed: down in a blink, a beat, then a bouncy way back. */
export function flattened(e: number): number {
  if (e < 0 || e >= FLAT) return 0;
  const down = ease(e / 0.07) * (1 - ease((e - 0.45) / 0.25));
  const bounce =
    e > 0.45 ? Math.sin((e - 0.45) * 16) * Math.exp(-(e - 0.45) * 4.5) * 0.1 * (1 - ease((e - 1.2) / 0.4)) : 0;
  return 0.45 * down - bounce;
}

export function createCameraRig(
  camera: THREE.PerspectiveCamera,
  layout: Layout,
  onGaze: (yaw: number, pitch: number) => void,
) {
  const pos = new THREE.Vector3(0, 1.3, 3);
  const target = new THREE.Vector3(0, 1.3, 3);
  const view = { yaw: 0, pitch: 0, sentYaw: 0, sentPitch: 0 };
  const { lookAt: l, title } = layout.cameras;
  const lookAt = new THREE.Vector3(l.x, l.y, l.z);
  const titleLookAt = new THREE.Vector3(title.lookAt.x, title.lookAt.y, title.lookAt.z);
  /** Drifting for the title screens until the first seat(). */
  let drifting = true;
  let driftTime = 0;
  const d = new THREE.Vector3();
  let gazeTimer = 0;
  /** Seconds since a hammer flattened you, or -1. */
  let flatT = -1;

  return {
    /** Sit behind the seat at (x, z). `snap` skips the glide (first view of the table), except from the title drift. */
    seat(x: number, z: number, dealer: boolean, snap: boolean) {
      const p = layout.cameras.seat(x, z, dealer);
      target.set(p.x, p.y, p.z);
      // from the title screens, glide down into the seat rather than jump
      if (snap && !drifting) pos.copy(target);
      drifting = false;
    },
    drag(dx: number, dy: number) {
      if (drifting) return;
      view.yaw = THREE.MathUtils.clamp(view.yaw - dx * 0.003, -1.9, 1.9);
      view.pitch = THREE.MathUtils.clamp(view.pitch - dy * 0.00225, -0.55, 0.9);
    },
    recenter() {
      view.yaw = 0;
      view.pitch = 0;
    },
    /** A hammer just flattened you: your eyes drop to the table with your bean, and bounce back up. */
    flatten() {
      flatT = 0;
    },
    update(dt: number) {
      if (drifting) {
        driftTime += dt;
        const a = title.angle + Math.sin(driftTime * title.swaySpeed) * title.sway;
        const y = title.height + Math.sin(driftTime * title.bobSpeed) * title.bob;
        pos.set(Math.cos(a) * title.radius, y, Math.sin(a) * title.radius);
        camera.position.copy(pos);
        camera.lookAt(titleLookAt);
        return;
      }
      pos.lerp(target, Math.min(1, dt * 3));
      camera.position.copy(pos);
      if (flatT >= 0) {
        flatT += dt;
        camera.position.y -= flattened(flatT);
        if (flatT > FLAT) flatT = -1;
      }
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
