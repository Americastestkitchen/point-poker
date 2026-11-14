// The card in front of each seat: it slides or is set down onto the felt,
// sits a little crooked, gets fiddled with, and flips over on the reveal.
// After the reveal it can be grabbed back and a new one slapped down face up.
import * as THREE from "three";
import { cardBack, cardFront, swapTag } from "../art/textures.ts";
import type { Layout } from "../layout/layout.ts";

const CARD_W = 0.16,
  CARD_H = 0.23;

export interface TableCard {
  readonly group: THREE.Group;
  /** The face value, or null for a card whose face we don't know. During a swap, the card on its way down. */
  readonly value: number | null;
  /** Face up, or waiting its turn to turn up. */
  readonly isFaceUp: boolean;
  /** Your own card doesn't float a big copy over the table when it flips. */
  noFloat: boolean;
  /**
   * Puts the card on the felt (if it isn't there yet) showing `value`. It flies in
   * from `from`, a point or a moving hand; `delay` holds it in the hand first, and
   * `gentle` sets it down low and flat instead of tossing it.
   */
  show(
    value: number | null,
    from?: THREE.Vector3 | (() => THREE.Vector3),
    opts?: { delay?: number; gentle?: boolean },
  ): void;
  /** Where the card lies for this seat at this table size. */
  placeAt(slot: number, count: number, mine: boolean): void;
  /** Someone fiddles with the card after `delay` seconds: it wiggles and ends up (mostly) straight. */
  nudge(delay?: number): void;
  hide(): void;
  /** Turns it face up showing `value`, after `delay` seconds; `onTurn` runs as it starts to turn. */
  turnUp(value: number | null, opts?: { delay?: number; onTurn?: () => void }): void;
  /**
   * Someone changed their card after the reveal: after `grab` seconds the card goes up into
   * `hand`, and at `slap` the new one comes down face up, hard (`onSlap` runs as it hits).
   */
  swap(value: number, hand: () => THREE.Vector3, opts: { grab: number; slap: number; onSlap?: () => void }): void;
  /** The card they had at the reveal, shown over the floating copy as "3 → 5" (null: no change to show). */
  setWas(value: number | null): void;
  turnDown(): void;
  update(dt: number): void;
}

/** Where the card is. */
type Placement =
  | { at: "hidden" }
  /** In someone's hand: it leaves after `wait` seconds, from wherever the hand is by then. */
  | { at: "hand"; wait: number; hand: () => THREE.Vector3; how: Landing }
  /** On its way down to the felt; `t` goes 0..1. */
  | { at: "landing"; t: number; how: Landing }
  | { at: "felt" }
  /** Being swapped: on the felt until `grab`, up in the hand until `slap`, then `next` lands. `t` counts seconds. */
  | {
      at: "swapping";
      t: number;
      grab: number;
      slap: number;
      hand: () => THREE.Vector3;
      next: number;
      onSlap?: () => void;
    };

/** How a card comes down: hand-placed ones drift in low and flat, tossed ones arc and spin, slapped ones smack down fast. */
type Landing = "gentle" | "toss" | "slap";

/** Which way up it is. On a reveal, a card can wait its turn before it turns. */
type Facing =
  | { side: "down" }
  | { side: "waiting to turn"; in: number; value: number | null; onTurn?: () => void }
  | { side: "up" };

/** A playing card: two faces back to back. */
function cardMesh() {
  const g = new THREE.Group();
  const geo = new THREE.PlaneGeometry(CARD_W, CARD_H);
  const frontMat = new THREE.MeshStandardMaterial({ map: cardBack(), roughness: 0.55 });
  const front = new THREE.Mesh(geo, frontMat);
  const back = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: cardBack(), roughness: 0.55 }));
  back.rotation.y = Math.PI;
  front.castShadow = back.castShadow = true;
  g.add(front, back);
  const setValue = (value: number | null) => {
    frontMat.map = value === null ? cardBack() : cardFront(value);
    frontMat.needsUpdate = true;
  };
  return { object: g, setValue };
}

export function createTableCard(scene: THREE.Scene, layout: Layout): TableCard {
  const group = new THREE.Group();
  const card = cardMesh();
  card.object.scale.setScalar(1.5);
  group.add(card.object);
  group.visible = false;
  /** Once flipped, a big copy of the card floats up so the whole table can read it. */
  const float = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false, transparent: true }));
  float.renderOrder = 9;
  float.visible = false;
  /** "3 → 5" over the floating copy, once someone changed their card after the reveal. */
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false, transparent: true }));
  tag.renderOrder = 10;
  tag.visible = false;
  scene.add(float, tag, group);

  let value: number | null = null;
  let was: number | null = null;
  let place: Placement = { at: "hidden" };
  let facing: Facing = { side: "down" };
  /** The flip animation, following `facing`: 0 face down .. 1 face up. */
  let flip = 0;
  const from = new THREE.Vector3();
  const home = new THREE.Vector3();
  const base = new THREE.Vector3();
  let floatT = 0;
  /** What the floating copy and the tag were last drawn showing. */
  let floatShows: number | null = null;
  let tagShows: string | null = null;
  let yaw = 0;
  /** How crooked the card sits; adjusting squares it back up. */
  let skew = 0,
    skewTarget = 0;
  const shift = new THREE.Vector3();
  const shiftTarget = new THREE.Vector3();
  let wiggle = 0;
  /** Seconds until someone fiddles with it, if anyone's about to. */
  let nudgeIn: number | null = null;

  const setValue = (next: number | null) => {
    if (next === value) return;
    value = next;
    card.setValue(next);
  };

  const self: TableCard = {
    group,
    get value() {
      if (place.at === "swapping") return place.next;
      return facing.side === "waiting to turn" ? facing.value : value;
    },
    get isFaceUp() {
      return facing.side !== "down";
    },
    noFloat: false,

    show(next, fromWorld, opts = {}) {
      if (place.at === "hidden") {
        const how: Landing = opts.gentle ? "gentle" : "toss";
        if (typeof fromWorld === "function") place = { at: "hand", wait: opts.delay ?? 0, hand: fromWorld, how };
        else if (fromWorld) {
          from.copy(fromWorld);
          place = { at: "landing", t: 0, how };
        } else {
          base.copy(home);
          place = { at: "felt" };
        }
        // land a little crooked, like a real person dropping a card
        skew = skewTarget = (Math.random() - 0.5) * 0.5;
        shift.set((Math.random() - 0.5) * 0.06, 0, (Math.random() - 0.5) * 0.05);
        shiftTarget.copy(shift);
      }
      group.visible = true;
      setValue(next);
    },

    placeAt(slot, count, mine) {
      const { position: p, yaw: y } = layout.card(slot, count, mine);
      home.set(p.x, p.y, p.z);
      yaw = y;
    },

    nudge(delay = 0) {
      nudgeIn = delay;
    },

    hide() {
      place = { at: "hidden" };
      facing = { side: "down" };
      nudgeIn = null;
      group.visible = false;
      flip = 0;
      float.visible = false;
      floatT = 0;
      was = null;
      tag.visible = false;
    },

    swap(next, hand, { grab, slap, onSlap }) {
      if (place.at === "hidden") return;
      if (place.at === "swapping") {
        // changed again mid-swap: the new card is the one that comes down
        place.next = next;
        return;
      }
      place = { at: "swapping", t: 0, grab, slap, hand, next, onSlap };
    },

    setWas(next) {
      if (next === was) return;
      was = next;
      // a new tag pops in with the floating copy
      floatT = Math.min(floatT, 0.5);
    },

    turnUp(next, { delay = 0, onTurn } = {}) {
      if (delay > 0) {
        facing = { side: "waiting to turn", in: delay, value: next, onTurn };
        return;
      }
      setValue(next);
      facing = { side: "up" };
      onTurn?.();
    },

    turnDown() {
      facing = { side: "down" };
    },

    update(dt) {
      if (place.at === "hidden") return;
      if (place.at === "hand") {
        // still in someone's hand
        place.wait -= dt;
        card.object.visible = false;
        if (place.wait > 0) return;
        from.copy(place.hand());
        place = { at: "landing", t: 0, how: place.how };
      }
      let held = false;
      if (place.at === "swapping") {
        place.t += dt;
        if (place.t >= place.slap) {
          // the new card comes down from the hand, face up
          from.copy(place.hand());
          setValue(place.next);
          const { onSlap } = place;
          place = { at: "landing", t: 0, how: "slap" };
          onSlap?.();
        } else held = place.t >= place.grab;
      }
      card.object.visible = true;
      if (nudgeIn !== null) {
        nudgeIn -= dt;
        if (nudgeIn < 0) {
          nudgeIn = null;
          wiggle = 1;
          skewTarget = (Math.random() - 0.5) * 0.08;
          shiftTarget.set((Math.random() - 0.5) * 0.015, 0, (Math.random() - 0.5) * 0.015);
        }
      }
      if (wiggle > 0) {
        wiggle = Math.max(0, wiggle - dt * 1.3);
        const k = Math.min(1, dt * 5);
        skew += (skewTarget - skew) * k;
        shift.lerp(shiftTarget, k);
      }
      if (facing.side === "waiting to turn") {
        facing.in -= dt;
        if (facing.in <= 0) self.turnUp(facing.value, { onTurn: facing.onTurn });
      }
      if (flip > 0.98 && value !== null && !self.noFloat && place.at === "felt") {
        if (!float.visible || floatShows !== value) {
          float.material.map = cardFront(value);
          float.material.needsUpdate = true;
          float.visible = true;
          floatShows = value;
        }
        floatT = Math.min(1, floatT + dt * 3);
        const k = 1 - Math.pow(1 - floatT, 3);
        float.position.copy(home).y += 0.12 + k * 0.2;
        float.scale.set(0.2 * k, 0.29 * k, 1);
        const tagFor = was !== null && was !== value ? `${was}:${value}` : null;
        tag.visible = tagFor !== null;
        if (tagFor !== null && tagShows !== tagFor && was !== null) {
          tag.material.map = swapTag(was, value);
          tag.material.needsUpdate = true;
          tagShows = tagFor;
        }
        tag.position.copy(float.position).y += 0.2 * k;
        tag.scale.set(0.2 * k, 0.075 * k, 1);
      } else if (facing.side !== "up" || place.at !== "felt") {
        float.visible = false;
        tag.visible = false;
        floatT = 0;
      }
      const target = facing.side === "up" ? 1 : 0;
      flip += Math.sign(target - flip) * Math.min(Math.abs(target - flip), dt * 2.6);
      // landing: an eased slide from where it left the hand (or was tossed from) to its spot
      let e = 1,
        how: Landing = "toss";
      if (place.at === "landing") {
        how = place.how;
        place.t = Math.min(1, place.t + dt * (how === "slap" ? 6 : 2.4));
        // a slap speeds up into the felt; the others ease in
        e = how === "slap" ? place.t * place.t : 1 - Math.pow(1 - place.t, 3);
        if (place.t >= 1) {
          place = { at: "felt" };
          if (how === "slap") {
            // smack: it shudders and sits a little crooked
            wiggle = 1;
            skewTarget = (Math.random() - 0.5) * 0.3;
          }
        }
      }
      if (place.at === "landing") base.lerpVectors(from, home, e);
      else if (held && place.at === "swapping") base.lerp(place.hand(), Math.min(1, dt * 14));
      else base.lerp(home, Math.min(1, dt * 6));
      group.position.copy(base).add(shift);
      const jiggle = Math.sin(wiggle * 30) * wiggle;
      group.position.x += jiggle * 0.012;
      const arc = how === "gentle" ? 0.05 : how === "slap" ? 0 : 0.25;
      group.position.y += Math.sin(e * Math.PI) * arc + Math.sin(flip * Math.PI) * 0.12 + Math.abs(jiggle) * 0.006;
      group.rotation.y = yaw + skew + jiggle * 0.12;
      // face down = front pointing at the felt; held up in a hand, it tips towards whoever holds it
      card.object.rotation.x = Math.PI / 2 - flip * Math.PI + (held ? 0.5 : 0);
      card.object.rotation.z = (1 - e) * (how === "gentle" ? 0.7 : how === "slap" ? 0.3 : 4);
    },
  };
  return self;
}
