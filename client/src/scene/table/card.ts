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
  faceUp(up: boolean): void;
  update(dt: number): void;
}

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
  let flip = 0; // 0 face down, 1 face up
  let flipTarget = 0;
  let arrive = 1; // 0..1 slide-in progress
  const from = new THREE.Vector3();
  const home = new THREE.Vector3();
  const base = new THREE.Vector3();
  let floatT = 0;
  /** Seconds before a placed card leaves the hand. */
  let wait = 0;
  let fromFn: (() => THREE.Vector3) | null = null;
  /** Hand-placed cards drift in low and flat; tossed ones arc and spin. */
  let gentle = false;
  let yaw = 0;
  /** How crooked the card sits; adjusting squares it back up. */
  let skew = 0, skewTarget = 0;
  const shift = new THREE.Vector3();
  const shiftTarget = new THREE.Vector3();
  let wiggle = 0;
  let nudgeIn = -1;

  const self: TableCard = {
    group,
    get value() { return value; },
    get isFaceUp() { return flipTarget === 1; },
    noFloat: false,

    show(next, fromWorld, opts = {}) {
      if (!group.visible) {
        wait = 0; fromFn = null; gentle = !!opts.gentle;
        if (typeof fromWorld === "function") { fromFn = fromWorld; wait = opts.delay ?? 0; from.copy(home); arrive = 0; }
        else if (fromWorld) { from.copy(fromWorld); arrive = 0; }
        else { base.copy(home); arrive = 1; }
        // land a little crooked, like a real person dropping a card
        skew = skewTarget = (Math.random() - 0.5) * 0.5;
        shift.set((Math.random() - 0.5) * 0.06, 0, (Math.random() - 0.5) * 0.05);
        shiftTarget.copy(shift);
      }
      group.visible = true;
      if (next !== value) {
        value = next;
        card.setValue(next);
      }
    },

    placeAt(slot, count, mine) {
      const { position: p, yaw: y } = layout.card(slot, count, mine);
      home.set(p.x, p.y, p.z);
      yaw = y;
    },

    nudge(delay = 0) { nudgeIn = delay; },

    hide() {
      wait = 0; fromFn = null; nudgeIn = -1; group.visible = false;
      flip = flipTarget = 0; float.visible = false; floatT = 0;
    },

    faceUp(up) { flipTarget = up ? 1 : 0; },

    update(dt) {
      if (!group.visible) return;
      if (wait > 0) {
        // still in someone's hand
        wait -= dt;
        card.object.visible = false;
        if (wait > 0) return;
        if (fromFn) from.copy(fromFn());
      }
      card.object.visible = true;
      if (nudgeIn >= 0) {
        nudgeIn -= dt;
        if (nudgeIn < 0) {
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
      } else if (flipTarget === 0) {
        float.visible = false;
        floatT = 0;
      }
      const speed = 2.6;
      flip += Math.sign(flipTarget - flip) * Math.min(Math.abs(flipTarget - flip), dt * speed);
      if (arrive < 1) arrive = Math.min(1, arrive + dt * 2.4);
      const e = 1 - Math.pow(1 - arrive, 3);
      if (arrive < 1) base.lerpVectors(from, home, e);
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
