// Clicking things in the 3D scene. Anything clickable registers itself with
// what to do when it's picked, so input code never needs to know what a duck is.
import * as THREE from "three";

export interface Picking {
  /** Makes `obj` (and everything inside it) clickable. Returns a function that undoes it. */
  register(obj: THREE.Object3D, onPick: () => void): () => void;
  /** What's under a screen point (CSS pixels), if anything clickable. */
  hit(x: number, y: number): (() => void) | null;
}

export function createPicking(camera: THREE.Camera, viewport: () => { width: number; height: number }): Picking {
  const targets = new Map<THREE.Object3D, () => void>();
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  return {
    register(obj, onPick) {
      targets.set(obj, onPick);
      return () => targets.delete(obj);
    },
    hit(x, y) {
      const { width, height } = viewport();
      ndc.set((x / width) * 2 - 1, -(y / height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObjects([...targets.keys()], true)[0];
      for (let o: THREE.Object3D | null = hit?.object ?? null; o; o = o.parent) {
        const onPick = targets.get(o);
        if (onPick) return onPick;
      }
      return null;
    },
  };
}
