// Cards on the felt: a face-down/face-up card in front of each seat.
import * as THREE from "three";
import { cardBack, cardFront } from "./textures.ts";
import { seatInfo } from "./world.ts";

export const CARD_W = 0.16, CARD_H = 0.23;

export function makeCard(value: number | null): THREE.Group {
  const g = new THREE.Group();
  const geo = new THREE.PlaneGeometry(CARD_W, CARD_H);
  const front = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: value === null ? cardBack() : cardFront(value), roughness: 0.55 }));
  front.name = "front";
  const back = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: cardBack(), roughness: 0.55 }));
  back.rotation.y = Math.PI;
  front.castShadow = back.castShadow = true;
  g.add(front, back);
  return g;
}

export function setCardValue(card: THREE.Group, value: number | null) {
  const front = card.getObjectByName("front") as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  front.material.map = value === null ? cardBack() : cardFront(value);
  front.material.needsUpdate = true;
}

/** A face-down/face-up card sitting on the felt in front of a seat. */
export class TableCard {
  readonly group = new THREE.Group();
  readonly card: THREE.Group;
  private flip = 0; // 0 face down, 1 face up
  private flipTarget = 0;
  private arrive = 1; // 0..1 slide-in progress
  private from = new THREE.Vector3();
  private home = new THREE.Vector3();
  /** Once flipped, a big copy of the card floats up so the whole table can read it. */
  private float = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false, transparent: true }));
  private floatT = 0;
  private base = new THREE.Vector3();
  value: number | null = null;
  noFloat = false;
  /** Seconds before a placed card leaves the hand. */
  private wait = 0;
  private fromFn: (() => THREE.Vector3) | null = null;
  /** Hand-placed cards drift in low and flat; tossed ones arc and spin. */
  private gentle = false;
  private yaw = 0;
  /** How crooked the card sits; adjusting squares it back up. */
  private skew = 0;
  private skewTarget = 0;
  private shift = new THREE.Vector3();
  private shiftTarget = new THREE.Vector3();
  private wiggle = 0;
  private nudgeIn = -1;

  constructor(scene: THREE.Scene) {
    this.card = makeCard(null);
    this.card.scale.setScalar(1.5);
    this.group.add(this.card);
    this.float.renderOrder = 9;
    this.float.visible = false;
    scene.add(this.float);
    this.group.visible = false;
    scene.add(this.group);
  }

  show(value: number | null, fromWorld?: THREE.Vector3 | (() => THREE.Vector3), opts: { delay?: number; gentle?: boolean } = {}) {
    if (!this.group.visible) {
      this.wait = 0; this.fromFn = null; this.gentle = !!opts.gentle;
      if (typeof fromWorld === "function") { this.fromFn = fromWorld; this.wait = opts.delay ?? 0; this.from.copy(this.home); this.arrive = 0; }
      else if (fromWorld) { this.from.copy(fromWorld); this.arrive = 0; }
      else { this.base.copy(this.home); this.arrive = 1; }
      // land a little crooked, like a real person dropping a card
      this.skew = this.skewTarget = (Math.random() - 0.5) * 0.5;
      this.shift.set((Math.random() - 0.5) * 0.06, 0, (Math.random() - 0.5) * 0.05);
      this.shiftTarget.copy(this.shift);
    }
    this.group.visible = true;
    if (value !== this.value) {
      this.value = value;
      setCardValue(this.card, value);
    }
  }

  placeAt(slot: number, count: number, reach = 0.62) {
    const s = seatInfo(slot, count);
    this.home.copy(s.toward(reach)).y += 0.004;
    this.yaw = s.facing + Math.PI;
  }

  /** Someone fiddles with the card: it wiggles and ends up (mostly) straight. */
  nudge(delay = 0) { this.nudgeIn = delay; }

  hide() { this.wait = 0; this.fromFn = null; this.nudgeIn = -1; this.group.visible = false; this.flip = this.flipTarget = 0; this.float.visible = false; this.floatT = 0; }
  faceUp(up: boolean) { this.flipTarget = up ? 1 : 0; }
  get isFaceUp() { return this.flipTarget === 1; }

  update(dt: number) {
    if (!this.group.visible) return;
    if (this.wait > 0) {
      // still in someone's hand
      this.wait -= dt;
      this.card.visible = false;
      if (this.wait > 0) return;
      if (this.fromFn) this.from.copy(this.fromFn());
    }
    this.card.visible = true;
    if (this.nudgeIn >= 0) {
      this.nudgeIn -= dt;
      if (this.nudgeIn < 0) {
        this.wiggle = 1;
        this.skewTarget = (Math.random() - 0.5) * 0.08;
        this.shiftTarget.set((Math.random() - 0.5) * 0.015, 0, (Math.random() - 0.5) * 0.015);
      }
    }
    if (this.wiggle > 0) {
      this.wiggle = Math.max(0, this.wiggle - dt * 1.3);
      const k = Math.min(1, dt * 5);
      this.skew += (this.skewTarget - this.skew) * k;
      this.shift.lerp(this.shiftTarget, k);
    }
    if (this.flip > 0.98 && this.value !== null && !this.noFloat) {
      if (!this.float.visible) {
        this.float.material.map = cardFront(this.value);
        this.float.material.needsUpdate = true;
        this.float.visible = true;
      }
      this.floatT = Math.min(1, this.floatT + dt * 3);
      const k = 1 - Math.pow(1 - this.floatT, 3);
      this.float.position.copy(this.home).y += 0.12 + k * 0.2;
      this.float.scale.set(0.2 * k, 0.29 * k, 1);
    } else if (this.flipTarget === 0) {
      this.float.visible = false;
      this.floatT = 0;
    }
    const speed = 2.6;
    this.flip += Math.sign(this.flipTarget - this.flip) * Math.min(Math.abs(this.flipTarget - this.flip), dt * speed);
    if (this.arrive < 1) this.arrive = Math.min(1, this.arrive + dt * 2.4);
    const e = 1 - Math.pow(1 - this.arrive, 3);
    if (this.arrive < 1) this.base.lerpVectors(this.from, this.home, e);
    else this.base.lerp(this.home, Math.min(1, dt * 6));
    this.group.position.copy(this.base).add(this.shift);
    const jiggle = Math.sin(this.wiggle * 30) * this.wiggle;
    this.group.position.x += jiggle * 0.012;
    this.group.position.y += Math.sin(e * Math.PI) * (this.gentle ? 0.05 : 0.25) + Math.sin(this.flip * Math.PI) * 0.12 + Math.abs(jiggle) * 0.006;
    this.group.rotation.y = this.yaw + this.skew + jiggle * 0.12;
    // face down = front pointing at the felt
    this.card.rotation.x = Math.PI / 2 - this.flip * Math.PI;
    this.card.rotation.z = (1 - e) * (this.gentle ? 0.7 : 4);
  }

  /** World position of the card, for chips flying out of it. */
  get position() {
    return this.home;
  }
}
