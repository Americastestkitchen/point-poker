import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BONK_HIT,
  createAnimator,
  DIZZY,
  FLICK_RELEASE,
  POINT,
  SWAP_GRAB,
  SWAP_SLAP,
  THROW_RELEASE,
  type Animator,
  type Pose,
} from "./animator.ts";

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

test("putting a card down is one reach of the right arm, about a second long", () => {
  const a = still();
  a.play("placeCard");
  assert.equal(a.busyWithCard, true);
  const poses = run(a, 1.1);
  assert.ok(poses[17]!.arms[1].stretch > 1.5, "the right arm stretches out to the felt");
  assert.ok(
    poses.every((p) => Math.abs(p.arms[0].x + 1.15) < 1e-9),
    "the left hand stays put: no squaring up with both hands",
  );
  assert.ok(Math.abs(poses.at(-1)!.arms[1].stretch - 1) < 0.05, "back at rest");
  assert.equal(a.busyWithCard, false);
  a.play("adjustCard");
  assert.equal(a.busyWithCard, true);
});

test("squaring up the card waits until it's been put down", () => {
  const a = still();
  a.play("placeCard");
  run(a, 0.6);
  a.play("adjustCard"); // ignored: still putting it down
  run(a, 0.5);
  assert.equal(a.busyWithCard, false, "done at about 1.05s, not restarted by the adjust");
  a.play("adjustCard");
  a.play("placeCard"); // a new card takes over from the fiddle
  run(a, 0.9);
  assert.equal(a.busyWithCard, true);
});

test("swapping a card after the reveal reaches out, hoists it up, slaps it down and comes back", () => {
  const a = still();
  a.play("swapCard");
  assert.equal(a.busyWithCard, true);
  const poses = run(a, 1.2);
  const at = (sec: number) => poses[Math.round(sec * 60) - 1]!.arms[1];
  assert.ok(at(SWAP_GRAB).stretch > 1.4, "the right arm stretches out to grab the card");
  assert.ok(at(SWAP_SLAP - 0.15).x < -2.2, "then it's hoisted up high");
  assert.ok(at(SWAP_SLAP + 0.05).stretch > 1.4, "and slapped back down on the felt");
  assert.ok(Math.abs(poses.at(-1)!.arms[1].stretch - 1) < 0.05, "back at rest");
  assert.equal(a.busyWithCard, false);
  a.play("swapCard");
  a.play("adjustCard"); // ignored: busy swapping
  run(a, 0.9);
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

/** The right arm `sec` seconds into `poses`. */
const rightArm = (poses: Pose[], sec: number) => poses[Math.round(sec * 60) - 1]!.arms[1];
const AIM = { x: -1.7, z: -0.4, reach: 9 };

test("pointing swings the right arm round to whoever it's aimed at and keeps it there a couple of seconds", () => {
  const a = still();
  a.setAim(AIM);
  a.play("point");
  assert.equal(a.aiming, true);
  const poses = run(a, POINT + 0.4);
  for (const sec of [0.6, 1.5, 2.2]) {
    const arm = rightArm(poses, sec);
    assert.ok(Math.abs(arm.x - AIM.x) < 0.02 && Math.abs(arm.z - AIM.z) < 0.02, `on them at ${sec}s`);
    assert.ok(arm.stretch > 2 && arm.stretch < AIM.reach * 0.5, "held out towards them, not all the way over");
    assert.equal(poses[Math.round(sec * 60) - 1]!.prop, "finger", "with a finger out");
  }
  assert.equal(poses.at(-1)!.prop, null);
  assert.equal(a.aiming, false);
  assert.ok(Math.abs(poses.at(-1)!.arms[1].x + 1.15) < 0.01, "back at rest");
});

test("the arm follows whoever it's aimed at while it points", () => {
  const a = still();
  a.setAim(AIM);
  a.play("point");
  run(a, 1);
  a.setAim({ ...AIM, z: 0.5 });
  assert.ok(Math.abs(run(a, 0.5, 1).at(-1)!.arms[1].z - 0.5) < 0.02);
});

test("the hammer goes all the way over with the arm held high, then comes down on them", () => {
  const a = still();
  a.setAim(AIM);
  a.play("bonk");
  const poses = run(a, 1.3);
  const up = rightArm(poses, 0.28);
  assert.ok(up.x < AIM.x - 0.6, "held high over them");
  assert.ok(up.stretch > AIM.reach * 0.7, "already stretched most of the way");
  const down = rightArm(poses, BONK_HIT + 0.05);
  assert.ok(Math.abs(down.x - AIM.x) < 0.1, "down on their head");
  assert.ok(Math.abs(down.stretch - AIM.reach) < 0.3, "at full stretch");
  assert.equal(poses[Math.round(BONK_HIT * 60)]!.prop, "hammer");
  assert.equal(poses.at(-1)!.prop, null, "the hammer goes away again");
  assert.ok(Math.abs(poses.at(-1)!.arms[1].stretch - 1) < 0.05, "and the arm snaps back");
});

test("each item is in the hand until it's let go", () => {
  const held = (clip: "flick" | "throw", seconds: number) => {
    const a = still();
    a.setAim(AIM);
    a.play(clip);
    return run(a, seconds).map((p) => p.prop);
  };
  const frame = (sec: number) => Math.round(sec * 60);
  const chip = held("flick", 0.5);
  assert.equal(chip[frame(FLICK_RELEASE) - 2], "chip");
  assert.equal(chip[frame(FLICK_RELEASE) + 1], null, "the chip is off the thumb");
  const plane = held("throw", 0.7);
  assert.equal(plane[frame(THROW_RELEASE) - 2], "plane");
  assert.equal(plane[frame(THROW_RELEASE) + 1], null, "the plane is in the air");
});

test("a poke isn't aimed at anyone", () => {
  const a = still();
  a.play("poke");
  assert.equal(a.aiming, false);
});

test("a hammer blow flattens the bean, which springs back up seeing stars", () => {
  const a = still();
  a.play("squashed");
  const poses = run(a, DIZZY + 0.2);
  assert.ok(poses[8]!.body.sy < 0.65, "flat within a blink");
  assert.ok(poses[8]!.body.sx > 1.25, "and spread out");
  assert.ok(poses[20]!.body.sy < 0.65, "it stays down a beat");
  assert.ok(poses[30]!.dizzy > 1.5, "seeing stars");
  assert.equal(poses.at(-1)!.dizzy, 0, "the head clears");
  assert.ok(Math.abs(poses.at(-1)!.body.sy - 1) < 0.03, "back in shape");
});

test("a paper plane bops softer than a chip bonks", () => {
  const dip = (clip: "bonked" | "bopped") => {
    const a = still();
    a.play(clip);
    return 1 - Math.min(...run(a, 1).map((p) => p.body.sy));
  };
  assert.ok(dip("bopped") > 0.02 && dip("bopped") < dip("bonked") * 0.6);
});

test("being pointed at widens the eyes for a moment, and nothing else", () => {
  const b = still();
  b.play("noticed");
  const seen = run(b, 0.1).at(-1)!;
  assert.ok(seen.face.eyeScale > 1.1 && Math.abs(seen.body.rotX) < 1e-9);
  const settled = run(b, 1, 0.1).at(-1)!;
  assert.equal(settled.face.eyeScale, 1);
});

test("the wheel's emotes each have their own move, and all end after two seconds", () => {
  const at = (id: "thumbs" | "party" | "sleepy" | "love", sec = 1) => {
    const a = still();
    a.play(id);
    const poses = run(a, 2.3);
    assert.equal(poses[0]!.emote?.id, id);
    assert.equal(poses.at(-1)!.emote, null, `${id} ends`);
    assert.ok(Math.abs(poses.at(-1)!.arms[1].x + 1.15) < 0.01, `${id}: the arm comes back down`);
    return poses[Math.round(sec * 60) - 1]!;
  };
  const thumbs = at("thumbs");
  assert.ok(thumbs.arms[1].x < -1.6, "a fist held out front");
  assert.ok(Math.abs(thumbs.arms[0].x + 1.15) < 1e-9, "with the other arm at rest");
  const party = at("party");
  assert.ok(party.arms[0].x < -2.2 && party.arms[1].x < -2.2, "both arms up");
  const sleepy = at("sleepy");
  assert.ok(sleepy.face.eyeScale < 0.7, "eyes closing");
  assert.ok(sleepy.face.mouthOpen > 0.9, "a big yawn");
  const love = at("love");
  assert.ok(love.arms[0].z > 0.2 && love.arms[1].z < -0.2, "arms wrapped in across the chest");
  assert.ok(love.face.eyeScale > 1.1);
});
