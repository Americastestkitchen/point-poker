// "Pointlings": googly-eyed bean creatures that sit at the table. The rig
// builds a body from its shape's data, hangs cosmetics on anchors, and
// applies the animator's pose every frame.
import * as THREE from "three";
import { cosmetic } from "../../../shared/catalog/cosmetics.ts";
import { EMOTES, type EmoteId } from "../../../shared/catalog/emotes.ts";
import type { Look } from "../../../shared/look.ts";
import { mesh, toon } from "../scene/materials.ts";
import { Animator, type ClipId, type HandPose } from "./animator.ts";
import { BUILDERS, SLOT_ANCHOR, visor } from "./cosmetics/index.ts";
import { bubbleTexture, tagTexture } from "./labels.ts";
import { SHAPES, anchorsFor, type AnchorId, type Spot } from "./shapes.ts";
import { TORSOS } from "./torsos.ts";

const EMOJI = Object.fromEntries(EMOTES.map((e) => [e.id, e.emoji])) as Record<EmoteId, string>;

/** The meshes of one body shape, rebuilt when the shape changes. */
interface Rig {
  anchors: Record<AnchorId, THREE.Object3D>;
  eyes: THREE.Object3D[];
  pupils: THREE.Mesh[];
  smile: THREE.Mesh;
  mouthHole: THREE.Mesh;
  shoulders: THREE.Object3D[];
  limbs: { arm: THREE.Mesh; hand: THREE.Mesh }[];
  /** What's worn, hanging off the anchors. */
  worn: THREE.Object3D[];
  eyeScale: number;
  mouthScale: number;
}

const place = <T extends THREE.Object3D>(o: T, s: Spot): T => { o.position.set(s.x, s.y, s.z); o.scale.setScalar(s.s); return o; };

export class Avatar {
  readonly group = new THREE.Group();
  /** An invisible cylinder that's easy to click. */
  readonly hitbox: THREE.Mesh;
  private readonly body = new THREE.Group();
  private readonly bodyMat: THREE.MeshToonMaterial;
  private readonly dealer: boolean;
  private readonly animator = new Animator();
  private look: Look;
  private rig!: Rig;
  private readonly tag: THREE.Sprite;
  private readonly bubble: THREE.Sprite;
  private bubbleText = "";
  private tagKey = "";
  private emoteSprite: THREE.Sprite | null = null;

  constructor(look: Look, opts: { dealer?: boolean } = {}) {
    this.look = look;
    this.dealer = !!opts.dealer;
    this.bodyMat = toon(look.color);
    this.group.add(chair(this.dealer));

    this.hitbox = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 1.0), new THREE.MeshBasicMaterial({ visible: false }));
    this.hitbox.position.y = 1.0;
    this.group.add(this.hitbox, this.body);

    this.tag = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false, transparent: true }));
    this.tag.scale.set(0.9, 0.28, 1);
    this.tag.visible = false;
    this.tag.renderOrder = 10;
    this.bubble = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false, transparent: true }));
    this.bubble.scale.set(0.24, 0.24, 1);
    this.bubble.renderOrder = 10;
    this.bubble.visible = false;
    this.group.add(this.tag, this.bubble);
    this.build();
  }

  /** Colour, shape and what they're wearing. A new shape is swapped in place; callers never rebuild. */
  setLook(look: Look) {
    const prev = this.look;
    this.look = look;
    this.bodyMat.color.set(look.color);
    if (look.body !== prev.body) this.build();
    else if (look.cosmetics.join() !== prev.cosmetics.join()) this.dress();
  }

  play(clip: ClipId) {
    this.animator.play(clip);
    if (clip in EMOJI) this.showEmoji(EMOJI[clip as EmoteId]);
  }

  setHandPose(p: HandPose) {
    this.animator.handPose = p;
  }

  /** A point on the bean to attach things to. */
  anchor(name: AnchorId): THREE.Object3D {
    return this.rig.anchors[name];
  }

  setGaze(yaw: number, pitch: number) { this.animator.setGaze(yaw, pitch); }
  setTalk(level: number) { this.animator.setTalk(level); }
  get busyWithCard() { return this.animator.busyWithCard; }

  setTag(name: string, chips: number, color: string, connected: boolean) {
    const line2 = connected ? `🪙 ${chips}` : "zzz (away)";
    const key = name + line2 + color;
    if (key === this.tagKey) return;
    this.tagKey = key;
    this.tag.material.map?.dispose();
    this.tag.material.map = tagTexture(name, line2, color);
    this.tag.material.needsUpdate = true;
    this.tag.visible = true;
    this.bodyMat.transparent = !connected;
    this.bodyMat.opacity = connected ? 1 : 0.45;
  }

  /** "" hides it; otherwise a short text or emoji. */
  setBubble(text: string) {
    if (text === this.bubbleText) return;
    this.bubbleText = text;
    this.bubble.visible = !!text;
    if (text) {
      this.bubble.material.map?.dispose();
      this.bubble.material.map = bubbleTexture(text);
      this.bubble.material.needsUpdate = true;
    }
  }

  /** Where a flicked chip hits: the same spot on every shape. */
  headWorldPos(out = new THREE.Vector3()) {
    return this.body.localToWorld(out.set(0, 1.15, 0.1));
  }

  /** Where the right hand is right now (world space). */
  handWorldPos(out = new THREE.Vector3()) {
    return this.anchor("handR").getWorldPosition(out);
  }

  update(dt: number, t: number) {
    const pose = this.animator.update(dt, t);
    const r = this.rig;
    const b = pose.body;
    this.body.scale.set(b.sx, b.sy, b.sx);
    this.body.position.y = b.y;
    this.body.rotation.set(b.rotX, b.rotY, b.rotZ);

    pose.arms.forEach((arm, i) => {
      r.shoulders[i].rotation.x = arm.x;
      r.shoulders[i].rotation.z = arm.z;
      const l = r.limbs[i];
      l.arm.scale.set(1, arm.stretch, 1);
      l.arm.position.y = -0.14 * arm.stretch;
      l.hand.position.y = -0.3 * arm.stretch;
    });

    const f = pose.face;
    for (const eye of r.eyes) eye.scale.setScalar(r.eyeScale * f.eyeScale);
    r.pupils.forEach((p, i) => p.position.set(f.pupils[i].x, f.pupils[i].y, f.pupils[i].z).multiplyScalar(0.08));
    r.mouthHole.visible = f.mouthOpen > 0.03;
    r.smile.visible = !r.mouthHole.visible;
    r.mouthHole.scale.set((0.05 + f.mouthOpen * 0.02) * r.mouthScale, (0.016 + f.mouthOpen * 0.07) * r.mouthScale, 0.03);

    if (this.emoteSprite) {
      if (pose.emote) {
        this.emoteSprite.position.y = 1.6 + pose.emote.t * 0.25;
        this.emoteSprite.material.opacity = Math.max(0, 1 - Math.max(0, pose.emote.t - 1.4) * 2);
      } else {
        this.group.remove(this.emoteSprite);
        this.emoteSprite.material.map?.dispose();
        this.emoteSprite = null;
      }
    }

    for (const w of r.worn) {
      const spin = w.getObjectByName("spin");
      if (spin) spin.rotation.y += dt * 12;
    }
  }

  private showEmoji(emoji: string) {
    if (this.emoteSprite) this.group.remove(this.emoteSprite);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: bubbleTexture(emoji), depthTest: false, transparent: true }));
    s.scale.set(0.4, 0.4, 1);
    s.position.y = 1.6;
    s.renderOrder = 11;
    this.emoteSprite = s;
    this.group.add(s);
  }

  /** Builds the body for the current shape: torso, face, arms and anchors. */
  private build() {
    this.body.clear();
    const S = SHAPES[this.look.body];
    const A = anchorsFor(this.look.body);
    const torso = TORSOS[this.look.body]();
    torso.material = this.bodyMat;
    torso.castShadow = true;
    this.body.add(torso);

    if (S.belly) {
      const belly = mesh(new THREE.SphereGeometry(0.2, 16, 12), toon("#ffffff", { transparent: true, opacity: 0.25 }), false);
      belly.scale.set(S.belly.sx, S.belly.sy, 0.5);
      belly.position.set(0, S.belly.y, S.belly.z);
      this.body.add(belly);
    }

    const eyes: THREE.Group[] = [];
    const pupils: THREE.Mesh[] = [];
    for (const spot of [A.eyeL, A.eyeR]) {
      const eye = place(new THREE.Group(), spot);
      const white = mesh(new THREE.SphereGeometry(0.115, 20, 16), toon("#ffffff"));
      const pupil = mesh(new THREE.SphereGeometry(0.052, 14, 10), new THREE.MeshBasicMaterial({ color: "#111" }), false);
      eye.add(white, pupil);
      this.body.add(eye);
      eyes.push(eye);
      pupils.push(pupil);
    }

    const smile = mesh(new THREE.TorusGeometry(0.055, 0.013, 6, 16, Math.PI), new THREE.MeshBasicMaterial({ color: "#2a1414" }), false);
    place(smile, A.mouth);
    smile.rotation.z = Math.PI;
    this.body.add(smile);
    // open mouth for talking: a dark oval with a little tongue
    const hole = mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: "#2a1414" }), false);
    const tongue = mesh(new THREE.SphereGeometry(0.55, 12, 8), new THREE.MeshBasicMaterial({ color: "#d9566a" }), false);
    tongue.position.set(0, -0.45, 0.35);
    tongue.scale.set(1, 0.6, 0.5);
    hole.add(tongue);
    hole.position.set(0, A.mouth.y - 0.025 * A.mouth.s, A.mouth.z - 0.003);
    hole.scale.set(0.05, 0.001, 0.025);
    hole.visible = false;
    this.body.add(hole);

    const shoulders: THREE.Group[] = [];
    const limbs: Rig["limbs"] = [];
    for (const [i, spot] of [A.shoulderL, A.shoulderR].entries()) {
      const shoulder = new THREE.Group();
      shoulder.position.set(spot.x, spot.y, spot.z);
      const arm = mesh(new THREE.CapsuleGeometry(0.055, 0.22, 4, 10), this.bodyMat);
      arm.position.y = -0.14;
      const hand = mesh(new THREE.SphereGeometry(0.07, 12, 10), this.bodyMat);
      hand.position.y = -0.3;
      shoulder.add(arm, hand);
      shoulder.rotation.x = -1.15;
      shoulder.rotation.z = (i ? 1 : -1) * 0.25;
      this.body.add(shoulder);
      shoulders.push(shoulder);
      limbs.push({ arm, hand });
    }

    // empty markers where things can be attached; the head is where hats stand
    const marker = (spot: Spot) => { const o = place(new THREE.Object3D(), spot); this.body.add(o); return o; };
    const anchors: Rig["anchors"] = {
      head: marker(A.head), eyes: marker(A.eyes), mouth: marker(A.mouth), chest: marker(A.chest),
      eyeL: eyes[0], eyeR: eyes[1], shoulderL: shoulders[0], shoulderR: shoulders[1], handL: limbs[0].hand, handR: limbs[1].hand,
    };

    if (this.dealer) {
      const bow = new THREE.Group();
      for (const s of [-1, 1]) {
        const w = mesh(new THREE.ConeGeometry(0.05, 0.09, 4), toon("#b3202a"));
        w.rotation.z = s * Math.PI / 2;
        w.position.x = s * 0.045;
        bow.add(w);
      }
      anchors.chest.add(bow);
      anchors.head.add(visor());
    }

    this.tag.position.y = A.tag.y;
    this.bubble.position.set(A.bubble.x, A.bubble.y, A.bubble.z);
    this.rig = { anchors, eyes, pupils, smile, mouthHole: hole, shoulders, limbs, worn: [], eyeScale: S.eye.s, mouthScale: S.mouth.s };
    this.dress();
  }

  /** Puts on what the look says, each item on its slot's anchor. */
  private dress() {
    for (const w of this.rig.worn) w.removeFromParent();
    this.rig.worn = this.look.cosmetics.map((id) => {
      const item = BUILDERS[id]();
      // hats sit a little higher on a dealer, over the visor
      if (this.dealer && cosmetic(id)?.slots.includes("head")) item.position.y += 0.04;
      item.rotation.z = (Math.random() - 0.5) * 0.25;
      this.anchor(SLOT_ANCHOR[cosmetic(id)!.slots[0]]).add(item);
      return item;
    });
  }
}

/** Every bean gets a chair; the house gets a fancier one. */
function chair(dealer: boolean): THREE.Group {
  const g = new THREE.Group();
  const wood = toon("#3a2216");
  const seat = mesh(new THREE.BoxGeometry(0.56, 0.06, 0.52), wood);
  seat.position.set(0, 0.5, -0.04);
  const back = mesh(new THREE.BoxGeometry(0.56, 0.7, 0.06), wood);
  back.position.set(0, 0.86, -0.3);
  back.rotation.x = -0.08;
  g.add(seat, back);
  for (const [x, z] of [[-0.24, -0.26], [0.24, -0.26], [-0.24, 0.18], [0.24, 0.18]]) {
    const leg = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.48), wood);
    leg.position.set(x, 0.24, z);
    g.add(leg);
  }
  if (dealer) {
    const crest = mesh(new THREE.TorusGeometry(0.2, 0.03, 8, 20, Math.PI), toon("#e6be5a"));
    crest.position.set(0, 1.2, -0.31);
    g.add(crest);
  }
  return g;
}
