// Your first-person body: built for every shape with the head out of your eyes, and posed by
// your bean's animator with its arms swapped, so you do things with your right hand.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { BODY_IDS } from "../../../shared/catalog/bodies.ts";
import { DEFAULT_LOOK } from "../../../shared/look.ts";
import { createAnimator } from "./animator.ts";
import { BODY_SHAPES } from "./bodies/index.ts";
import { createFirstPersonBody, neckOf } from "./first-person.ts";

/** The highest point of the body's own meshes (the torso and tummy, not the arms). */
function top(group: THREE.Object3D): number {
  const body = group.children[0]!;
  let y = -Infinity;
  for (const part of body.children) {
    if (!(part instanceof THREE.Mesh)) continue;
    part.geometry.computeBoundingBox();
    y = Math.max(y, part.geometry.boundingBox!.max.y);
  }
  return y;
}

test("every shape's head sinks into its shoulders, below where the camera sits", () => {
  const fp = createFirstPersonBody(DEFAULT_LOOK);
  for (const body of BODY_IDS) {
    fp.setLook({ ...DEFAULT_LOOK, body });
    const neck = neckOf(BODY_SHAPES[body]);
    const y = top(fp.group);
    assert.ok(y > neck.y, `${body}: still has shoulders`);
    assert.ok(y < neck.y + 0.15, `${body}: head squashed (top at ${y.toFixed(2)})`);
    assert.ok(y < 1.3, `${body}: well below your eyes`);
  }
});

test("your bean's right arm, the one it waves with, is your right hand", () => {
  const fp = createFirstPersonBody(DEFAULT_LOOK);
  const a = createAnimator({ random: () => 0.5, now: () => 0 });
  a.play("wave");
  let pose = a.update(1 / 60, 0);
  for (let i = 1; i < 20; i++) pose = a.update(1 / 60, i / 60);
  fp.apply(pose);
  fp.group.updateMatrixWorld(true);
  // the hand highest up is the waving one; it's on your right (-x, as you face +z)
  const hands = fp.group.children[0]!.children.filter((c) => c instanceof THREE.Group);
  const [waving] = hands
    .map((s) => s.children.at(-1)!.getWorldPosition(new THREE.Vector3()))
    .toSorted((p, q) => q.y - p.y);
  assert.ok(waving && waving.x < 0, "waving hand on your right");
});
