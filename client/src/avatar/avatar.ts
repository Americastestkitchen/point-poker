// "Pointlings": googly-eyed bean creatures that sit at the table. An avatar
// puts together a body shape, its parts (face, arms, labels, chair) and what
// it's wearing, and applies the animator's pose every frame.
import * as THREE from "three";
import { cosmetic } from "../../../shared/catalog/cosmetics.ts";
import { EMOTES, type EmoteId } from "../../../shared/catalog/emotes.ts";
import type { Look } from "../../../shared/look.ts";
import { mesh, toon } from "../scene/art/materials.ts";
import { createAnimator, type ClipId, type HandPose } from "./animator.ts";
import { anchorsFor, type AnchorId, type Spot } from "./bodies/anchors.ts";
import { BODY_SHAPES } from "./bodies/index.ts";
import { BUILDERS, DEALER_GEAR, SLOT_ANCHOR } from "./cosmetics/index.ts";
import { buildArms, type Arms } from "./parts/arms.ts";
import { buildChair } from "./parts/chair.ts";
import { buildFace, type Face } from "./parts/face.ts";
import { createLabels } from "./parts/labels.ts";

export interface Avatar {
  readonly group: THREE.Group;
  /** An invisible cylinder that's easy to click. */
  readonly hitbox: THREE.Mesh;
  /** Placing or squaring up a card right now. */
  readonly busyWithCard: boolean;
  /** Colour, shape and what they're wearing. A new shape is swapped in place; callers never rebuild. */
  setLook(look: Look): void;
  play(clip: ClipId): void;
  setHandPose(pose: HandPose): void;
  /** A point on the bean to attach things to. */
  anchor(name: AnchorId): THREE.Object3D;
  /** Where they're looking, relative to facing the table. */
  setGaze(yaw: number, pitch: number): void;
  /** Mic loudness 0..1. */
  setTalk(level: number): void;
  setTag(name: string, chips: number, color: string, connected: boolean): void;
  /** "" hides it; otherwise a short text or emoji. */
  setBubble(text: string): void;
  /** Where a flicked chip hits: the same spot on every shape. */
  headWorldPos(out?: THREE.Vector3): THREE.Vector3;
  /** Where the right hand is right now. */
  handWorldPos(out?: THREE.Vector3): THREE.Vector3;
  update(dt: number, t: number): void;
}

const EMOJI = Object.fromEntries(EMOTES.map((e) => [e.id, e.emoji])) as Record<EmoteId, string>;

const marker = (spot: Spot) => {
  const o = new THREE.Object3D();
  o.position.set(spot.x, spot.y, spot.z);
  o.scale.setScalar(spot.s);
  return o;
};

export function createAvatar(initial: Look, opts: { dealer?: boolean } = {}): Avatar {
  let look = initial;
  const dealer = !!opts.dealer;
  const animator = createAnimator();
  const material = toon(look.color);
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(buildChair(dealer));
  const hitbox = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 1.0), new THREE.MeshBasicMaterial({ visible: false }));
  hitbox.position.y = 1.0;
  group.add(hitbox, body);
  const labels = createLabels(group);

  let parts!: { face: Face; arms: Arms; anchors: Record<AnchorId, THREE.Object3D> };
  let worn: THREE.Object3D[] = [];

  /** Builds the body for the current shape: torso, tummy, face, arms and anchors. */
  function build() {
    body.clear();
    const shape = BODY_SHAPES[look.body];
    const A = anchorsFor(shape);
    const torso = shape.torso();
    torso.material = material;
    torso.castShadow = true;
    body.add(torso);
    if (shape.belly) {
      const belly = mesh(new THREE.SphereGeometry(0.2, 16, 12), toon("#ffffff", { transparent: true, opacity: 0.25 }), false);
      belly.scale.set(shape.belly.sx, shape.belly.sy, 0.5);
      belly.position.set(0, shape.belly.y, shape.belly.z);
      body.add(belly);
    }
    const face = buildFace(shape, body);
    const arms = buildArms(shape, material, body);
    // empty markers where things can be attached; the head is where hats stand
    const head = marker(A.head), eyes = marker(A.eyes), mouth = marker(A.mouth), chest = marker(A.chest);
    body.add(head, eyes, mouth, chest);
    const anchors: Record<AnchorId, THREE.Object3D> = {
      head, eyes, mouth, chest,
      eyeL: face.eyeL, eyeR: face.eyeR,
      shoulderL: arms.shoulderL, shoulderR: arms.shoulderR, handL: arms.handL, handR: arms.handR,
    };
    if (dealer) for (const gear of DEALER_GEAR) anchors[gear.anchor].add(gear.build());
    parts = { face, arms, anchors };
    labels.fit(shape);
    dress();
  }

  /** Puts on what the look says, each item on its slot's anchor. */
  function dress() {
    for (const w of worn) w.removeFromParent();
    worn = look.cosmetics.map((id) => {
      const item = BUILDERS[id]();
      const { slots } = cosmetic(id)!;
      // hats sit a little higher on a dealer, over the visor
      if (dealer && slots.includes("head")) item.position.y += 0.04;
      item.rotation.z = (Math.random() - 0.5) * 0.25;
      parts.anchors[SLOT_ANCHOR[slots[0]]].add(item);
      return item;
    });
  }

  build();

  return {
    group,
    hitbox,
    get busyWithCard() { return animator.busyWithCard; },

    setLook(next) {
      const prev = look;
      look = next;
      material.color.set(next.color);
      if (next.body !== prev.body) build();
      else if (next.cosmetics.join() !== prev.cosmetics.join()) dress();
    },

    play(clip) {
      animator.play(clip);
      if (clip in EMOJI) labels.showEmoji(EMOJI[clip as EmoteId]);
    },

    setHandPose(pose) { animator.handPose = pose; },
    anchor: (name) => parts.anchors[name],
    setGaze: (yaw, pitch) => animator.setGaze(yaw, pitch),
    setTalk: (level) => animator.setTalk(level),

    setTag(name, chips, color, connected) {
      if (!labels.setTag(name, connected ? `🪙 ${chips}` : "zzz (away)", color)) return;
      // someone who's away goes see-through
      material.transparent = !connected;
      material.opacity = connected ? 1 : 0.45;
    },

    setBubble: (text) => labels.setBubble(text),
    headWorldPos: (out = new THREE.Vector3()) => body.localToWorld(out.set(0, 1.15, 0.1)),
    handWorldPos: (out = new THREE.Vector3()) => parts.anchors.handR.getWorldPosition(out),

    update(dt, t) {
      const pose = animator.update(dt, t);
      const b = pose.body;
      body.scale.set(b.sx, b.sy, b.sx);
      body.position.y = b.y;
      body.rotation.set(b.rotX, b.rotY, b.rotZ);
      parts.arms.apply(pose.arms);
      parts.face.apply(pose.face);
      labels.apply(pose.emote);
      for (const w of worn) {
        const spin = w.getObjectByName("spin");
        if (spin) spin.rotation.y += dt * 12;
      }
    },
  };
}
