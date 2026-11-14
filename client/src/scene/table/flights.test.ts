import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createFlights } from "./flights.ts";

/** Flies `obj` for `seconds` at 60fps and returns where it was each frame. */
function fly(flights: ReturnType<typeof createFlights>, obj: THREE.Object3D, seconds: number) {
  const path: THREE.Vector3[] = [];
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    flights.update(1 / 60);
    path.push(obj.position.clone());
  }
  return path;
}
const flight = (obj: THREE.Object3D, extra: { loop?: number; nose?: boolean; done?: () => void } = {}) => ({
  obj,
  from: new THREE.Vector3(0, 1, 0),
  to: new THREE.Vector3(4, 1, 0),
  t: 0,
  dur: 1,
  arc: 0.5,
  spin: 0,
  ...extra,
});

test("a flight arcs from one point to the other and says when it's landed", () => {
  const flights = createFlights();
  const obj = new THREE.Object3D();
  let landed = 0;
  flights.add(flight(obj, { done: () => landed++ }));
  const path = fly(flights, obj, 1.1);
  assert.ok(Math.abs(Math.max(...path.map((p) => p.y)) - 1.5) < 0.01, "half a metre up in the middle");
  assert.ok(obj.position.distanceTo(new THREE.Vector3(4, 1, 0)) < 1e-6);
  assert.equal(landed, 1);
});

test("a paper plane loops the loop on its way, and still lands where it was going", () => {
  const flights = createFlights();
  const obj = new THREE.Object3D();
  flights.add(flight(obj, { loop: 0.8, nose: true }));
  const path = fly(flights, obj, 1.1);
  assert.ok(Math.max(...path.map((p) => p.y)) > 2.1, "over the top of the loop");
  assert.ok(
    path.some((p, i) => i > 0 && p.x < path[i - 1]!.x - 1e-4),
    "it comes back on itself",
  );
  assert.ok(obj.position.distanceTo(new THREE.Vector3(4, 1, 0)) < 1e-6);
});

test("something flying nose first points the way it's going", () => {
  const flights = createFlights();
  const obj = new THREE.Object3D();
  flights.add({ ...flight(obj, { nose: true }), arc: 0 });
  fly(flights, obj, 0.5);
  const nose = new THREE.Vector3(0, 0, 1).applyQuaternion(obj.quaternion);
  assert.ok(nose.distanceTo(new THREE.Vector3(1, 0, 0)) < 1e-6);
});
