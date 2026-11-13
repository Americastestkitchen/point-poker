// Parts of an item that move while the bean talks: a moustache lifts and
// wobbles, a beard drops with the jaw, eyebrows bounce. Builders mark them
// here; the rig moves them with the mouth every frame.
import type * as THREE from "three";

export interface Talk {
  /** How far it moves (item units) with the mouth wide open; negative drops it. */
  lift: number;
  /** How much it rocks side to side while talking, in radians. */
  wobble: number;
}

const TALKS = new WeakMap<THREE.Object3D, Talk>();

/** Marks `part` to move with the mouth; returns it so builders can chain. */
export function talks<T extends THREE.Object3D>(part: T, motion: Talk): T {
  TALKS.set(part, motion);
  return part;
}

/** Everything under `item` that moves with the mouth, with where it rests. */
export function talkers(item: THREE.Object3D) {
  const found: { part: THREE.Object3D; motion: Talk; y: number; rz: number }[] = [];
  item.traverse((part) => {
    const motion = TALKS.get(part);
    if (motion) found.push({ part, motion, y: part.position.y, rz: part.rotation.z });
  });
  return found;
}
