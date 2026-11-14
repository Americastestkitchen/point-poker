// The small helpers rooms build with: a mesh of a common shape, and putting
// something in its place. Each shape takes its sizes, then its material; the
// segment counts are three.js's own defaults when left out.
import * as THREE from "three";

type Mat = THREE.Material | THREE.Material[];

/** Puts `o` at (x, y, z), turned `ry` about the vertical when given, and hands it back. */
export function put<T extends THREE.Object3D>(o: T, x: number, y: number, z: number, ry?: number): T {
  o.position.set(x, y, z);
  if (ry !== undefined) o.rotation.y = ry;
  return o;
}

/** A box, `w` wide, `h` high and `d` deep. */
export const box = <M extends Mat>(w: number, h: number, d: number, mat: M) =>
  new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);

/** An upright cylinder, `top` and `bottom` its radii. */
export const cylinder = <M extends Mat>(top: number, bottom: number, height: number, mat: M, segments?: number) =>
  new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, height, segments), mat);

/** A ball. */
export const sphere = <M extends Mat>(radius: number, mat: M, across?: number, down?: number) =>
  new THREE.Mesh(new THREE.SphereGeometry(radius, across, down), mat);

/** A flat sheet, `w` by `h`, facing +z. */
export const plane = <M extends Mat>(w: number, h: number, mat: M) =>
  new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
