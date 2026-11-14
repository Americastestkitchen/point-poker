// Your own body as you see it from your seat: torso, tummy, arms and hands, in your colour and
// shape. It's your bean minus what you can't see of yourself: no face, and the head squashed
// down to the shoulders (your camera sits just above and behind it). It's posed by your bean's
// animator, so when your bean waves, flicks a chip or celebrates, these arms do it too.
// scene/first-person.ts stands it where your bean sits and draws it over the room.
import * as THREE from "three";
import type { Look } from "../../../shared/look.ts";
import { toon } from "../scene/art/materials.ts";
import type { ArmPose, Pose } from "./animator.ts";
import { BODY_SHAPES } from "./bodies/index.ts";
import type { BodyShape } from "./bodies/body.ts";
import { buildArms, type Arms } from "./parts/arms.ts";
import { buildBelly } from "./parts/belly.ts";
import { createHeld } from "./parts/props.ts";

export interface FirstPersonBody {
  /** Stands where your bean does, facing the same way. */
  readonly group: THREE.Group;
  /** Colour and shape. A new shape is built in place. */
  setLook(look: Look): void;
  /** Copies your bean's pose, with whatever it's holding. Returns true when something new was built to hold. */
  apply(pose: Pose): boolean;
}

/** Where the head starts squashing (body space), and how much of it is left above that. */
export function neckOf(shape: BodyShape) {
  return { y: shape.shoulder.y + 0.1, keep: 0.25 };
}

/**
 * Like any FPS, your arms are a bit bigger than your bean's and sit higher and further forward,
 * so a wave or a flick comes up into view instead of happening below the bottom of the screen.
 */
export const FIRST_PERSON_ARMS = { scale: 1.1, up: 0.05, forward: 0.1 };
const ARMS = FIRST_PERSON_ARMS;

export function createFirstPersonBody(initial: Look): FirstPersonBody {
  let look = initial;
  const material = toon(look.color);
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  let arms!: Arms;
  // what your bean holds in its right hand, you hold in yours: the arm drawn on this body's left.
  // The straw is in a mouth you can't see, so it's left out.
  const held = createHeld((prop) => (prop === "straw" ? null : arms.handL));
  let holding: Pose["prop"] = null;

  function build() {
    held.reset();
    holding = null;
    release(body, material);
    const shape = BODY_SHAPES[look.body];
    const neck = neckOf(shape);
    body.add(new THREE.Mesh(squashHead(shape.torso(), neck.y, neck.keep), material));
    const belly = buildBelly(shape);
    if (belly) body.add(new THREE.Mesh(squashHead(belly, neck.y, neck.keep), belly.material));
    arms = buildArms(shape, material, body);
    for (const shoulder of [arms.shoulderL, arms.shoulderR]) {
      shoulder.scale.setScalar(ARMS.scale);
      shoulder.position.y += ARMS.up;
      shoulder.position.z += ARMS.forward;
    }
  }

  build();

  return {
    group,
    setLook(next) {
      const prev = look;
      look = next;
      material.color.set(next.color);
      if (next.body !== prev.body) build();
    },
    apply(pose) {
      const b = pose.body;
      body.scale.set(b.sx, b.sy, b.sx);
      body.position.y = b.y;
      body.rotation.set(b.rotX, b.rotY, b.rotZ);
      // the arm a bean waves, flicks and plays cards with is on the right as others look at it,
      // which is its own left; swapped, you do all that with your right hand
      const [l, r] = pose.arms;
      arms.apply([inView({ ...r, z: -r.z }, -1), inView({ ...l, z: -l.z }, 1)]);
      held.apply(pose.prop);
      const fresh = pose.prop !== holding && pose.prop !== null;
      holding = pose.prop;
      return fresh;
    },
  };
}

/** A raised arm swings in towards the middle, so you see yourself wave and cheer. `side` is -1 for the left. */
function inView(arm: ArmPose, side: -1 | 1): ArmPose {
  const raised = Math.min(1, Math.max(0, (-arm.x - 1.7) / 0.9));
  return { ...arm, z: arm.z - side * 0.2 * raised };
}

/**
 * `m`'s shape in its parent's space, with everything above `y` squashed down to `keep` of its
 * height: a body whose head has sunk into its shoulders, so it stays out of your eyes.
 */
function squashHead(m: THREE.Mesh, y: number, keep: number): THREE.BufferGeometry {
  m.updateMatrix();
  const g = m.geometry.clone().applyMatrix4(m.matrix);
  m.geometry.dispose();
  const pos = g.getAttribute("position");
  for (let i = 0; i < pos.count; i++) {
    const py = pos.getY(i);
    if (py > y) pos.setY(i, y + (py - y) * keep);
  }
  g.computeBoundingSphere();
  return g;
}

/** Meshes own a geometry and materials to free. */
const isMesh = (o: THREE.Object3D): o is THREE.Mesh => o instanceof THREE.Mesh;

/** Takes the parts off `body` and frees what they held on the GPU, except the bean's own material. */
function release(body: THREE.Object3D, keep: THREE.Material) {
  body.traverse((o) => {
    if (!isMesh(o)) return;
    o.geometry.dispose();
    for (const m of [o.material].flat()) if (m !== keep) m.dispose();
  });
  body.clear();
}
