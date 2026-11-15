// Your eyes: the camera sits behind your seat and you drag to look around.
// Where you look is shared (throttled) so your bean turns its head for others.
// Until you sit down it drifts slowly round the room for the title screens instead.
// While the table is in its lobby it watches the room from a corner, the same view for
// everyone; when the game starts it comes down into your seat.
import * as THREE from "three";
import type { Layout } from "../layout/layout.ts";

/** How long being flattened lasts, down and back up (seconds). */
const FLAT = 1.6;
/** How long the camera takes between the lobby's corner and your seat (seconds). */
export const SIT_DOWN = 1.8;
/** This far up from your seat (0 to 1) you see the room from outside, your own bean included. */
const OUTSIDE = 0.25;
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
  const { lobby } = layout.cameras;
  const corner = new THREE.Vector3(lobby.position.x, lobby.position.y, lobby.position.z);
  /** Which way the camera faces from the corner. */
  const cornerFacing = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().lookAt(corner, new THREE.Vector3(lobby.lookAt.x, lobby.lookAt.y, lobby.lookAt.z), camera.up),
  );
  /** The table is in its lobby: the camera belongs up in the corner. */
  let watching = false;
  /** How far up towards the corner the camera is: 0 in your seat, 1 there. It glides between. */
  let lift = 0;
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
      if (watching) {
        // into a lobby from the title screens you're up in the corner at once: the two views
        // face opposite ends of the room, and gliding between them would fly through the lamp
        if (drifting) lift = 1;
        // from up there nobody sees your seat move, so the way down starts from where it is now
        if (lift === 1) pos.copy(target);
      } else if (snap && !drifting) pos.copy(target); // from the title screens, glide down into the seat rather than jump
      drifting = false;
    },
    /** The table is in its lobby (watch the room from the corner) or playing (come down into your seat). */
    watch(on: boolean) {
      watching = on;
    },
    /** How far up towards the lobby's corner the camera is, eased: 0 in your seat, 1 there. */
    lifted: () => ease(lift),
    /** Whether the camera is far enough from your seat to see your own bean in it. */
    outside: () => lift > OUTSIDE,
    drag(dx: number, dy: number) {
      if (drifting || watching) return;
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
      // between your seat and the lobby's corner
      const step = dt / SIT_DOWN;
      lift = watching ? Math.min(1, lift + step) : Math.max(0, lift - step);
      const up = ease(lift);
      if (up > 0) {
        camera.position.lerp(corner, up);
        camera.quaternion.slerp(cornerFacing, up);
      }
      const zoom = 1 + (lobby.zoom - 1) * up;
      if (camera.zoom !== zoom) {
        camera.zoom = zoom;
        camera.updateProjectionMatrix();
      }
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
