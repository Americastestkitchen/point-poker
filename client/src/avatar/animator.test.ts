import { test } from "node:test";
import assert from "node:assert/strict";
import { createAnimator, type Animator, type Pose } from "./animator.ts";

/** Runs the animator for `seconds` at 60fps and returns every pose. */
function run(a: Animator, seconds: number, from = 0): Pose[] {
  const poses: Pose[] = [];
  for (let i = 1; i <= Math.round(seconds * 60); i++) poses.push(a.update(1 / 60, from + i / 60));
  return poses;
}
const still = () => createAnimator({ random: () => 0.5, now: () => 0 });

test("at rest the arms hang forward and the face smiles", () => {
  const p = run(still(), 1).at(-1)!;
  assert.ok(Math.abs(p.arms[0].x + 1.15) < 1e-9 && Math.abs(p.arms[1].x + 1.15) < 1e-9);
  assert.deepEqual([p.arms[0].z, p.arms[1].z], [-0.25, 0.25]);
  assert.equal(p.face.mouthOpen, 0);
  assert.equal(p.face.eyeScale, 1);
  assert.equal(p.emote, null);
});

test("a wave raises the right arm, then ends after two seconds", () => {
  const a = still();
  a.play("wave");
  const poses = run(a, 2.2);
  assert.ok(Math.min(...poses.slice(0, 60).map((p) => p.arms[1].x)) < -2, "right arm up");
  assert.ok(
    poses.slice(0, 60).every((p) => Math.abs(p.arms[0].x + 1.15) < 1e-9),
    "left arm stays down",
  );
  assert.ok(poses[0]);
  assert.equal(poses[0].emote?.id, "wave");
  assert.equal(poses.at(-1)!.emote, null);
});

test("a shock widens the eyes", () => {
  const a = still();
  a.play("shock");
  assert.equal(run(a, 0.5).at(-1)!.face.eyeScale, 1.3);
  assert.equal(run(a, 2, 0.5).at(-1)!.face.eyeScale, 1);
});

test("putting a card down keeps the hands busy for about a second and a half", () => {
  const a = still();
  a.play("placeCard");
  assert.equal(a.busyWithCard, true);
  const reach = run(a, 0.3).at(-1)!;
  assert.ok(reach.arms[1].stretch > 1.5, "the right arm stretches out to the felt");
  run(a, 1.3, 0.3);
  assert.equal(a.busyWithCard, false);
  a.play("adjustCard");
  assert.equal(a.busyWithCard, true);
});

test("squaring up the card waits until it's been put down", () => {
  const a = still();
  a.play("placeCard");
  run(a, 1.0);
  a.play("adjustCard"); // ignored: still putting it down
  run(a, 0.5);
  assert.equal(a.busyWithCard, false, "done at about 1.45s, not restarted by the adjust");
  a.play("adjustCard");
  a.play("placeCard"); // a new card takes over from the fiddle
  run(a, 1.0);
  assert.equal(a.busyWithCard, true);
});

test("a bonk squashes the body and settles", () => {
  const a = still();
  a.play("bonked");
  const poses = run(a, 1);
  assert.ok(Math.min(...poses.map((p) => p.body.sy)) < 0.9);
  assert.ok(Math.abs(poses.at(-1)!.body.sy - 1) < 0.03);
});

test("talking opens the mouth, and it closes if the 'stopped' message never comes", () => {
  let now = 0;
  const a = createAnimator({ random: () => 0.5, now: () => now });
  a.setTalk(0.8);
  assert.ok(Math.max(...run(a, 0.5).map((p) => p.face.mouthOpen)) > 0.3);
  now = 2000;
  assert.equal(run(a, 1, 0.5).at(-1)!.face.mouthOpen, 0);
});

test("looking around turns the body and moves the pupils", () => {
  const a = still();
  a.setGaze(0.8, 0.3);
  const p = run(a, 2).at(-1)!;
  assert.ok(Math.abs(p.body.rotY - 0.48) < 0.01);
  assert.ok(p.face.pupils[0].x > 0.2 && p.face.pupils[1].x > 0.2);
});

test("a flick cocks the right arm up, snaps it out, then lets it rest", () => {
  const a = still();
  a.play("flick");
  const poses = run(a, 0.8);
  assert.ok(Math.min(...poses.slice(0, 12).map((p) => p.arms[1].x)) < -1.7, "cocked up");
  assert.ok(Math.max(...poses.map((p) => p.arms[1].stretch)) > 1.3, "snapped out");
  assert.ok(
    poses.every((p) => Math.abs(p.arms[0].x + 1.15) < 1e-9),
    "left arm stays put",
  );
  assert.ok(Math.abs(poses.at(-1)!.arms[1].x + 1.15) < 0.01, "back at rest");
});

test("a poke reaches out to the felt and comes back, without holding up a card", () => {
  const a = still();
  a.play("poke");
  const poses = run(a, 0.9);
  assert.ok(Math.max(...poses.map((p) => p.arms[1].stretch)) > 2, "reaches out");
  assert.equal(a.busyWithCard, false);
  assert.ok(Math.abs(poses.at(-1)!.arms[1].stretch - 1) < 0.01, "back at rest");
});
