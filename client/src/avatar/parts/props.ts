// The things a hand item puts in a bean's hand (or mouth) for a moment, and the ones that fly:
// a squeaky hammer, a chip, a paper plane, a straw and the spitball it shoots. Every bean shares
// the same geometry and materials, so making one costs nothing and nobody disposes them.
import * as THREE from "three";
import { toon } from "../../scene/art/materials.ts";
import type { Prop } from "../animator.ts";

/** How far past the hand the hammer's head is: an arm stretched this much short of someone lands it on them. */
export const HAMMER_REACH = 0.42;

type Parts = { geo: THREE.BufferGeometry; mat: THREE.Material; at?: (m: THREE.Mesh) => void }[];
const cache = new Map<string, Parts>();

/** A group of meshes built from `parts`, which are made once and shared from then on. */
function build(name: string, parts: () => Parts): THREE.Group {
  let made = cache.get(name);
  if (!made) cache.set(name, (made = parts()));
  const g = new THREE.Group();
  for (const p of made) {
    const m = new THREE.Mesh(p.geo, p.mat);
    m.castShadow = true;
    p.at?.(m);
    g.add(m);
  }
  return g;
}

/**
 * A toy hammer, held by the end of its handle: it carries on from the arm (the hand's -y), and
 * its two squeaky faces look along z, the way the arm swings.
 */
export function makeHammer(): THREE.Group {
  return build("hammer", () => {
    const red = toon("#e5343a");
    const face = toon("#ffd23f");
    const along = (y: number, z: number) => (m: THREE.Mesh) => {
      m.position.set(0, y, z);
      m.rotation.x = Math.PI / 2;
    };
    return [
      { geo: new THREE.CylinderGeometry(0.03, 0.036, 0.42), mat: face, at: (m) => m.position.set(0, -0.19, 0) },
      { geo: new THREE.CylinderGeometry(0.12, 0.12, 0.28, 18), mat: red, at: along(-HAMMER_REACH, 0) },
      { geo: new THREE.CylinderGeometry(0.138, 0.138, 0.05, 18), mat: face, at: along(-HAMMER_REACH, 0.155) },
      { geo: new THREE.CylinderGeometry(0.138, 0.138, 0.05, 18), mat: face, at: along(-HAMMER_REACH, -0.155) },
    ];
  });
}

/** A pointing finger in a white cartoon glove, sticking out of the hand the way the arm points. */
export function makeFinger(): THREE.Group {
  return build("finger", () => [
    {
      geo: new THREE.CapsuleGeometry(0.026, 0.09, 4, 8),
      mat: toon("#ffffff"),
      at: (m) => m.position.set(0, -0.1, 0),
    },
  ]);
}

/** The poker chip balanced on a thumb before it's flicked (the one that flies is scene/table/chips.ts's). */
function heldChip(): THREE.Group {
  return build("chip", () => [
    { geo: new THREE.CylinderGeometry(0.042, 0.042, 0.012, 20), mat: toon("#c0392b") },
    { geo: new THREE.CylinderGeometry(0.026, 0.026, 0.014, 20), mat: toon("#f3e7cf") },
  ]);
}

/** A paper plane, nose along +z. */
export function makePlane(): THREE.Group {
  return build("plane", () => {
    // nose, the two wing tips, and the keel's tail underneath: two wings and a folded keel
    const nose = [0, 0, 0.2],
      left = [-0.13, 0.018, -0.15],
      right = [0.13, 0.018, -0.15],
      spine = [0, 0, -0.15],
      keel = [0, -0.065, -0.15];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([nose, left, spine, nose, spine, right, nose, spine, keel].flat(), 3),
    );
    geo.computeVertexNormals();
    return [{ geo, mat: toon("#f6f1e6", { side: THREE.DoubleSide }) }];
  });
}

/** A drinking straw with a red stripe, pointing along +z from the mouth. */
export function makeStraw(): THREE.Group {
  const lying = (z: number) => (m: THREE.Mesh) => {
    m.position.z = z;
    m.rotation.x = Math.PI / 2;
  };
  return build("straw", () => [
    { geo: new THREE.CylinderGeometry(0.012, 0.012, 0.2, 8), mat: toon("#f6f1e6"), at: lying(0.1) },
    { geo: new THREE.CylinderGeometry(0.0125, 0.0125, 0.04, 8), mat: toon("#e5343a"), at: lying(0.15) },
  ]);
}

/** A chewed-up ball of paper. */
export function makeSpitball(): THREE.Group {
  return build("spitball", () => [{ geo: new THREE.IcosahedronGeometry(0.036, 1), mat: toon("#f4f6f2") }]);
}

/** `made`, moved and turned to sit in a hand. */
function inHand(made: THREE.Group, y: number, turnX = 0): THREE.Group {
  const g = new THREE.Group();
  made.position.y = y;
  made.rotation.x = turnX;
  g.add(made);
  return g;
}

/** What each prop looks like where a rig holds it: in the hand (whose -y runs on from the arm), or the mouth. */
const HELD: Record<Prop, () => THREE.Group> = {
  finger: makeFinger,
  // balanced on the thumb
  chip: () => inHand(heldChip(), -0.075),
  hammer: makeHammer,
  // pinched like a dart, nose along the arm
  plane: () => inHand(makePlane(), -0.1, Math.PI / 2),
  straw: makeStraw,
};

/** Shows whichever prop the pose calls for, each built the first time it's needed. */
export function createHeld(where: (prop: Prop) => THREE.Object3D | null) {
  const made = new Map<Prop, THREE.Group>();
  let showing: Prop | null = null;
  return {
    /** Call when the things props hang from were rebuilt (a new body shape). */
    reset() {
      for (const g of made.values()) g.removeFromParent();
      made.clear();
      showing = null;
    },
    apply(prop: Prop | null) {
      if (prop === showing) return;
      if (showing) made.get(showing)?.removeFromParent();
      showing = prop;
      if (!prop) return;
      let g = made.get(prop);
      if (!g) made.set(prop, (g = HELD[prop]()));
      where(prop)?.add(g);
    },
    /** Runs `fn` over every prop built so far (your first-person body moves them to its own layer). */
    each(fn: (g: THREE.Group) => void) {
      for (const g of made.values()) fn(g);
    },
  };
}
