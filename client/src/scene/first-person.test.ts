// Your first-person body is lit by whichever room you're in, including a room you've just moved to.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { lightsYourBody } from "./first-person.ts";

/** A room as it goes up: a light of its own, and one tucked inside a prop. */
function room() {
  const root = new THREE.Group();
  const sky = new THREE.HemisphereLight();
  const prop = new THREE.Group();
  const lamp = new THREE.PointLight();
  prop.add(lamp);
  root.add(sky, prop, new THREE.Mesh());
  return { root, lights: [sky, lamp] };
}

/** A camera that sees only the first-person pass. */
const firstPerson = new THREE.Camera();
firstPerson.layers.set(1);
const roomCamera = new THREE.Camera();

test("every light in a new room lights your body, and still lights the room", () => {
  for (const visit of ["first room", "next room", "first room again"]) {
    const { root, lights } = room();
    lightsYourBody(root);
    for (const light of lights) {
      assert.ok(light.layers.test(firstPerson.layers), `${visit}: ${light.type} lights your body`);
      assert.ok(light.layers.test(roomCamera.layers), `${visit}: ${light.type} lights the room`);
    }
  }
});
