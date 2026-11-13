// Shared material helpers: the chunky cartoon shading everything uses.
import * as THREE from "three";

let gradient: THREE.DataTexture | null = null;
export function toon(color: THREE.ColorRepresentation, extra: Partial<THREE.MeshToonMaterialParameters> = {}) {
  if (!gradient) {
    gradient = new THREE.DataTexture(new Uint8Array([60, 140, 255]), 3, 1, THREE.RedFormat);
    gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
    gradient.needsUpdate = true;
  }
  return new THREE.MeshToonMaterial({ color, gradientMap: gradient, ...extra });
}

export const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, shadow = true) => {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = shadow;
  return m;
};
