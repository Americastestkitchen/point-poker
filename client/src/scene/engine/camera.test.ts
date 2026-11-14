import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { layout } from "../layout/layout.ts";
import { createCameraRig, flattened } from "./camera.ts";

function setup() {
  const camera = new THREE.PerspectiveCamera();
  const gazes: number[][] = [];
  const rig = createCameraRig(camera, layout, (yaw, pitch) => void gazes.push([yaw, pitch]));
  return { camera, rig, gazes };
}

const seat = layout.cameras.seat(-2.38, 0, true);
const atSeat = (c: THREE.PerspectiveCamera) => c.position.distanceTo(new THREE.Vector3(seat.x, seat.y, seat.z));

test("before you sit, the camera drifts on the title circle and shares no gaze", () => {
  const { camera, rig, gazes } = setup();
  const { title } = layout.cameras;
  for (let i = 0; i < 300; i++) rig.update(0.1);
  assert.ok(Math.abs(Math.hypot(camera.position.x, camera.position.z) - title.radius) < 1e-9, "on the circle");
  assert.ok(Math.abs(camera.position.y - title.height) <= title.bob + 1e-9);
  rig.drag(200, 0);
  rig.update(0.2);
  assert.deepEqual(gazes, [], "dragging does nothing on the title screens");
});

test("from the drift, even the first (snapping) seat glides down into place", () => {
  const { camera, rig } = setup();
  rig.update(0.1);
  rig.seat(-2.38, 0, true, true);
  rig.update(0.1);
  assert.ok(atSeat(camera) > 0.5, "still on the way");
  for (let i = 0; i < 60; i++) rig.update(0.1);
  assert.ok(atSeat(camera) < 1e-3, "arrived");
});

test("once seated, a snapping seat jumps straight there", () => {
  const { camera, rig } = setup();
  rig.seat(2.38, 0, false, false);
  for (let i = 0; i < 60; i++) rig.update(0.1);
  rig.seat(-2.38, 0, true, true);
  rig.update(0.016);
  assert.ok(atSeat(camera) < 1e-9);
});

test("a hammer blow drops your eyes to the table for a beat, and they come back to where they were", () => {
  const { camera, rig } = setup();
  rig.seat(-2.38, 0, true, true);
  for (let i = 0; i < 200; i++) rig.update(0.1);
  const before = camera.position.y;
  rig.flatten();
  const heights: number[] = [];
  for (let i = 0; i < 120; i++) {
    rig.update(1 / 60);
    heights.push(camera.position.y);
  }
  assert.ok(Math.abs(heights[8]! - (before - 0.45)) < 0.02, "down in a blink");
  assert.ok(heights[20]! < before - 0.4, "it stays down a beat");
  assert.ok(Math.min(...heights) > layout.table.y, "never under the table");
  assert.ok(Math.abs(camera.position.y - before) < 1e-9, "and back up");
  assert.equal(flattened(-1), 0);
});
