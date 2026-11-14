// Freeing what a room put on the GPU: geometry, materials, their textures and
// shadow maps. mount.ts calls it on a room's whole tree, so rooms never write
// their own cleanup.
import * as THREE from "three";
import { isSharedTexture } from "../../scene/art/materials.ts";

/** Frees `material` and every texture it holds, except ones all toon materials share. */
export function disposeMaterial(material: THREE.Material) {
  const values: unknown[] = Object.values(material);
  for (const value of values) if (value instanceof THREE.Texture && !isSharedTexture(value)) value.dispose();
  material.dispose();
}

/** Meshes, points and lines own a geometry and materials. */
const ownsGeometry = (o: THREE.Object3D): o is THREE.Mesh | THREE.Points | THREE.Line =>
  o instanceof THREE.Mesh || o instanceof THREE.Points || o instanceof THREE.Line;

/** Frees everything `root` and its children hold. Take it off the stage first. */
export function disposeTree(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  root.traverse((o) => {
    if (ownsGeometry(o)) {
      geometries.add(o.geometry);
      for (const m of [o.material].flat()) materials.add(m);
    }
    if (o instanceof THREE.Light) o.dispose();
  });
  for (const g of geometries) g.dispose();
  for (const m of materials) disposeMaterial(m);
}
