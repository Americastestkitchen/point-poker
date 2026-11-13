// Your bean on show: the title screens and the look editor leave a box on the screen for it
// (store.showcase), and this draws it there, over the room, on a turntable under a spotlight.
// It's a second pass on the main stage's renderer (no renderer of its own), so the room keeps
// drawing behind it and the bean's look follows the editor's draft as you change it.
import * as THREE from "three";
import type { Look } from "../../../shared/look.ts";
import type { ScreenRect, Showcase, Store } from "../app/store.ts";
import { createAvatar, type Avatar } from "../avatar/avatar.ts";
import { mesh, toon } from "./art/materials.ts";
import type { Stage } from "./engine/stage.ts";

/** What the showcase camera must fit: the bean on its chair, its hat, and the turntable. */
const FRAME = { width: 1.9, height: 2.25, centerY: 1.02 } as const;
const FOV = 30;

/** Mounts the showcase; the function it returns takes it off the stage again. */
export function mountShowcase(stage: Stage, store: Store): () => void {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 40);
  scene.add(new THREE.HemisphereLight("#ffd9c0", "#301020", 1.3));
  const key = new THREE.DirectionalLight("#fff0d8", 1.6);
  key.position.set(1.5, 3, 2.5);
  scene.add(key);
  const spot = new THREE.SpotLight("#ffe7b8", 26, 9, 0.42, 0.55, 1.4);
  spot.position.set(0, 4.2, 0.6);
  spot.target.position.set(0, 0.6, 0);
  scene.add(spot, spot.target);
  scene.add(turntable(), lightCone());

  const stand = new THREE.Group();
  scene.add(stand);
  let shown: { avatar: Avatar; look: Look; dealer: boolean } | null = null;

  /** The avatar for `s`, rebuilt only when the dealer's gear comes or goes; it waves at each change. */
  function follow(s: Showcase) {
    if (shown && shown.dealer === s.dealer) {
      if (shown.look !== s.look) {
        shown.avatar.setLook(s.look);
        shown.avatar.play("wave");
        shown.look = s.look;
      }
      return shown.avatar;
    }
    if (shown) release(stand, shown.avatar.group);
    const avatar = createAvatar(s.look, { dealer: s.dealer });
    stand.add(avatar.group);
    shown = { avatar, look: s.look, dealer: s.dealer };
    return avatar;
  }

  const stopFrames = stage.onFrame((dt, t) => {
    const s = store.getState().showcase;
    if (!s) return;
    const avatar = follow(s);
    // a turntable that sways rather than spins, so the face is mostly towards you
    stand.rotation.y = Math.sin(t * 0.6) * 0.7;
    avatar.setGaze(Math.sin(t * 1.3) * 0.6, Math.sin(t * 0.9) * 0.3);
    avatar.update(dt, t);
  });

  const size = new THREE.Vector2();
  const stopPass = stage.afterRender(() => {
    const s = store.getState().showcase;
    if (!s || s.rect.width < 1 || s.rect.height < 1) return;
    const { renderer } = stage;
    renderer.getSize(size);
    const box = viewportOf(s.rect, size.y);
    aim(camera, s.rect.width / s.rect.height);
    renderer.setScissorTest(true);
    renderer.setScissor(box.x, box.y, box.width, box.height);
    renderer.setViewport(box.x, box.y, box.width, box.height);
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(scene, camera);
    renderer.autoClear = true;
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, size.x, size.y);
  });

  return () => {
    stopFrames();
    stopPass();
    if (shown) release(stand, shown.avatar.group);
    shown = null;
  };
}

/** How far back the camera stands for the bean and turntable to fill a box of this shape. */
export function fitDistance(aspect: number): number {
  const tan = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  return Math.max(FRAME.height / 2 / tan, FRAME.width / 2 / (tan * aspect));
}

/** A box from the top-left of the window as WebGL's viewport, which counts from the bottom-left. */
export function viewportOf(rect: ScreenRect, canvasHeight: number): ScreenRect {
  return { x: rect.x, y: canvasHeight - (rect.y + rect.height), width: rect.width, height: rect.height };
}

/** Meshes and sprites (the name tag, the bubbles) own a geometry and materials to free. */
const ownsGpuData = (o: THREE.Object3D): o is THREE.Mesh | THREE.Sprite =>
  o instanceof THREE.Mesh || o instanceof THREE.Sprite;

/** Takes `object` off the stage and frees what it held on the GPU. */
function release(parent: THREE.Object3D, object: THREE.Object3D) {
  parent.remove(object);
  object.traverse((o) => {
    if (!ownsGpuData(o)) return;
    o.geometry.dispose();
    for (const material of [o.material].flat()) material.dispose();
  });
}

/** Backs the camera off until the whole bean and its turntable fit a box of this shape. */
function aim(camera: THREE.PerspectiveCamera, aspect: number) {
  camera.aspect = aspect;
  camera.position.set(0, FRAME.centerY + 0.35, fitDistance(aspect));
  camera.lookAt(0, FRAME.centerY, 0);
  camera.updateProjectionMatrix();
}

/** A dark disc with a gold rim to stand on. */
function turntable() {
  const g = new THREE.Group();
  const top = mesh(new THREE.CylinderGeometry(0.72, 0.76, 0.08, 48), toon("#2b1c22"));
  top.position.y = -0.04;
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.74, 0.018, 8, 64),
    new THREE.MeshBasicMaterial({ color: "#e6be5a" }),
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.005;
  g.add(top, rim);
  return g;
}

/** The spotlight's beam, faint in the dust. */
function lightCone() {
  const cone = new THREE.Mesh(
    // narrower than the frame, so the box never cuts the beam off with a hard edge
    new THREE.ConeGeometry(0.7, 4, 48, 1, true),
    new THREE.MeshBasicMaterial({
      color: "#ffe2a8",
      transparent: true,
      opacity: 0.06,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  cone.position.y = 2;
  return cone;
}
