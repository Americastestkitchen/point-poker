// The card in front of each seat: it slides or is set down onto the felt,
// sits a little crooked, gets fiddled with, and flips over on the reveal.
import * as THREE from "three";
import { cardBack, cardFront } from "../art/textures.ts";
import { layout } from "../layout/layout.ts";

const CARD_W = 0.16, CARD_H = 0.23;

export interface TableCard {
  readonly group: THREE.Group;
  /** The face value, or null for a card whose face we don't know. */
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
  show(value: number | null, from?: THREE.Vector3 | (() => THREE.Vector3), opts?: { delay?: number; gentle?: boolean }): void;
  /** Where the card lies for this seat at this table size. */
  placeAt(slot: number, count: number, mine: boolean): void;
  /** Someone fiddles with the card after `delay` seconds: it wiggles and ends up (mostly) straight. */
  nudge(delay?: number): void;
  hide(): void;
  /** Turns it face up showing `value`, after `delay` seconds; `onTurn` runs as it starts to turn. */
  turnUp(value: number | null, opts?: { delay?: number; onTurn?: () => void }): void;
  turnDown(): void;
  update(dt: number): void;
}

/** Where the card is. */
type Placement =
  | { at: "hidden" }
  /** In someone's hand: it leaves after `wait` seconds, from wherever the hand is by then. */
  | { at: "hand"; wait: number; hand: () => THREE.Vector3; gentle: boolean }
  /** On its way down to the felt; `t` goes 0..1. Hand-placed cards drift in low and flat; tossed ones arc and spin. */
  | { at: "landing"; t: number; gentle: boolean }
  | { at: "felt" };

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

export function createTableCard(scene: THREE.Scene): TableCard {
  const group = new THREE.Group();
  const card = cardMesh();
  card.object.scale.setScalar(1.5);
  group.add(card.object);
  group.visible = false;
  /** Once flipped, a big copy of the card floats up so the whole table can read it. */
  const float = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false, transparent: true }));
  float.renderOrder = 9;
  float.visible = false;
  scene.add(float, group);

  let value: number | null = null;
  let place: Placement = { at: "hidden" };
  let facing: Facing = { side: "down" };
  /** The flip animation, following `facing`: 0 face down .. 1 face up. */
  let flip = 0;
  const from = new THREE.Vector3();
  const home = new THREE.Vector3();
  const base = new THREE.Vector3();
  let floatT = 0;
  let yaw = 0;
  /** How crooked the card sits; adjusting squares it back up. */
  let skew = 0, skewTarget = 0;
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
    get value() { return value; },
    get isFaceUp() { return facing.side !== "down"; },
    noFloat: false,

    show(next, fromWorld, opts = {}) {
      if (place.at === "hidden") {
        const gentle = !!opts.gentle;
        if (typeof fromWorld === "function") place = { at: "hand", wait: opts.delay ?? 0, hand: fromWorld, gentle };
        else if (fromWorld) { from.copy(fromWorld); place = { at: "landing", t: 0, gentle }; }
        else { base.copy(home); place = { at: "felt" }; }
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

    nudge(delay = 0) { nudgeIn = delay; },

    hide() {
      place = { at: "hidden" };
      facing = { side: "down" };
      nudgeIn = null;
      group.visible = false;
      flip = 0;
      float.visible = false;
      floatT = 0;
    },

    turnUp(next, { delay = 0, onTurn } = {}) {
      if (delay > 0) { facing = { side: "waiting to turn", in: delay, value: next, onTurn }; return; }
      setValue(next);
      facing = { side: "up" };
      onTurn?.();
    },

    turnDown() { facing = { side: "down" }; },

    update(dt) {
      if (place.at === "hidden") return;
      if (place.at === "hand") {
        // still in someone's hand
        place.wait -= dt;
        card.object.visible = false;
        if (place.wait > 0) return;
        from.copy(place.hand());
        place = { at: "landing", t: 0, gentle: place.gentle };
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
      if (flip > 0.98 && value !== null && !self.noFloat) {
        if (!float.visible) {
          float.material.map = cardFront(value);
          float.material.needsUpdate = true;
          float.visible = true;
        }
        floatT = Math.min(1, floatT + dt * 3);
        const k = 1 - Math.pow(1 - floatT, 3);
        float.position.copy(home).y += 0.12 + k * 0.2;
        float.scale.set(0.2 * k, 0.29 * k, 1);
      } else if (facing.side !== "up") {
        float.visible = false;
        floatT = 0;
      }
      const target = facing.side === "up" ? 1 : 0;
      flip += Math.sign(target - flip) * Math.min(Math.abs(target - flip), dt * 2.6);
      // landing: an eased slide from where it left the hand (or was tossed from) to its spot
      let e = 1, gentle = false;
      if (place.at === "landing") {
        place.t = Math.min(1, place.t + dt * 2.4);
        e = 1 - Math.pow(1 - place.t, 3);
        gentle = place.gentle;
        if (place.t >= 1) place = { at: "felt" };
      }
      if (place.at === "landing") base.lerpVectors(from, home, e);
      else base.lerp(home, Math.min(1, dt * 6));
      group.position.copy(base).add(shift);
      const jiggle = Math.sin(wiggle * 30) * wiggle;
      group.position.x += jiggle * 0.012;
      group.position.y += Math.sin(e * Math.PI) * (gentle ? 0.05 : 0.25) + Math.sin(flip * Math.PI) * 0.12 + Math.abs(jiggle) * 0.006;
      group.rotation.y = yaw + skew + jiggle * 0.12;
      // face down = front pointing at the felt
      card.object.rotation.x = Math.PI / 2 - flip * Math.PI;
      card.object.rotation.z = (1 - e) * (gentle ? 0.7 : 4);
    },
  };
  return self;
}
