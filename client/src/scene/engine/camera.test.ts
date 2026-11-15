import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { layout } from "../layout/layout.ts";
import { createCameraRig, flattened, SIT_DOWN } from "./camera.ts";

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

const { lobby } = layout.cameras;
const corner = new THREE.Vector3(lobby.position.x, lobby.position.y, lobby.position.z);

test("in a lobby the camera watches the room from its corner, and Start brings it down into your seat", () => {
  const { camera, rig, gazes } = setup();
  rig.update(0.1);
  rig.watch(true);
  rig.seat(-2.38, 0, true, true);
  rig.update(0.016);
  assert.ok(camera.position.distanceTo(corner) < 1e-9, "from the title screens you're up there at once");
  assert.equal(camera.zoom, lobby.zoom);
  assert.equal(rig.outside(), true, "your own bean is in the picture");
  const ahead = new THREE.Vector3();
  camera.getWorldDirection(ahead);
  const toTable = new THREE.Vector3(lobby.lookAt.x, lobby.lookAt.y, lobby.lookAt.z).sub(corner).normalize();
  assert.ok(ahead.distanceTo(toTable) < 1e-6, "looking at the table");
  rig.drag(200, 0);
  rig.update(0.2);
  assert.deepEqual(gazes, [], "dragging does nothing up there");

  rig.watch(false);
  rig.update(SIT_DOWN / 2);
  assert.ok(camera.position.distanceTo(corner) > 0.5 && atSeat(camera) > 0.5, "on its way down");
  for (let i = 0; i < 40; i++) rig.update(0.1);
  assert.ok(atSeat(camera) < 1e-3, "in your seat");
  assert.equal(camera.zoom, 1);
  assert.equal(rig.outside(), false);
  assert.equal(rig.lifted(), 0);
});

test("a seat that moves while you're up in the corner is where the camera comes down to", () => {
  const { camera, rig } = setup();
  rig.watch(true);
  rig.seat(2.38, 0, false, true);
  for (let i = 0; i < 30; i++) rig.update(0.1);
  rig.seat(-2.38, 0, true, false);
  rig.watch(false);
  for (let i = 0; i < 40; i++) rig.update(0.1);
  assert.ok(atSeat(camera) < 1e-3);
});
