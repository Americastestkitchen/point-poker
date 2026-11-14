// What using a hand item on someone looks like at the table: the bean's arm does its move with
// the item in its hand, something swings or flies across, there's a sound, and whoever it was
// for takes the hit. Nothing here changes the game: it plays what the server says just happened.
import * as THREE from "three";
import type { ItemId } from "../../../../shared/catalog/items.ts";
import type { Events } from "../../app/events.ts";
import type { Audio } from "../../audio/sfx.ts";
import { BLOW_RELEASE, BONK_HIT, FLICK_RELEASE, THROW_RELEASE } from "../../avatar/animator.ts";
import { makeCoin, makePlane, makeSpitball } from "../../avatar/parts/props.ts";
import type { Stage } from "../engine/stage.ts";
import type { Layout } from "../layout/layout.ts";
import type { Flights } from "./flights.ts";
import type { Seat } from "./seat.ts";

export interface ItemPlays {
  /** `from` used `item` on `to`. */
  play(from: string, item: ItemId, to: string): void;
}

/** How long a landed paper plane lies on the felt, and a spitball stays stuck (seconds). */
const PLANE_RESTS = 6,
  SPITBALL_STICKS = 8;

export function createItemPlays(
  stage: Stage,
  deps: {
    audio: Audio;
    layout: Layout;
    flights: Flights;
    events: Events;
    /** Your own id ("" before you're seated). */
    me(): string;
    seat(id: string): Seat | undefined;
    /** A hammer just landed on you: your view drops with your bean. */
    flattened(): void;
  },
): ItemPlays {
  const { audio, layout, flights, events } = deps;
  const { scene, camera } = stage;
  const isMe = (id: string) => id === deps.me();
  const avatarOf = (id: string) => deps.seat(id)?.avatar;
  /** A point in front of your own eyes: where your hand lets go of things, as you see it. */
  const inView = (x: number, y: number, z: number) => camera.localToWorld(new THREE.Vector3(x, y, z));
  const eyes = () => camera.getWorldPosition(new THREE.Vector3());

  // Where things are aimed. Your own bean is hidden on your screen: for you, it's your camera.
  const headOf = (id: string) =>
    isMe(id) ? eyes().add(new THREE.Vector3(0, -0.05, 0)) : (avatarOf(id)?.headWorldPos() ?? new THREE.Vector3());
  /** Where a hammer from `from` lands on `id`: the top of their head, or for you, just in front of your nose. */
  const crownOf = (id: string, from: string) => {
    if (!isMe(id)) return avatarOf(id)?.crownWorldPos() ?? new THREE.Vector3();
    const at = eyes();
    const towards = headOf(from).sub(at).setY(0).normalize();
    return at.addScaledVector(towards, 0.5).add(new THREE.Vector3(0, 0.12, 0));
  };
  /** Where the hand that just let go is: in front of you for your own, the bean's hand for everyone else's. */
  const handOf = (id: string, mine: THREE.Vector3) =>
    isMe(id) ? mine : (avatarOf(id)?.handWorldPos() ?? new THREE.Vector3());
  /** You took one: the screens show it (a flash, a splat on the glass). */
  const hit = (to: string, item: ItemId) => {
    if (isMe(to)) events.emit({ t: "hit", item });
  };

  const PLAYS: Record<ItemId, (from: string, to: string) => void> = {
    /** The empty hand: they point at whoever it is for a few seconds, who notices. */
    point(from, to) {
      avatarOf(from)?.aim("point", () => headOf(to));
      audio.point();
      avatarOf(to)?.play("noticed");
    },

    /** The rubber arm stretches across the table and brings the hammer down on their head. */
    hammer(from, to) {
      // your own head stays where it was when the swing started, though your view is about to drop
      const mine = isMe(to) ? crownOf(to, from) : null;
      avatarOf(from)?.aim("bonk", () => mine ?? crownOf(to, from));
      audio.swing();
      stage.after(BONK_HIT, () => {
        audio.squeak();
        avatarOf(to)?.play("squashed");
        hit(to, "hammer");
        if (isMe(to)) deps.flattened();
      });
    },

    /** A coin off the thumb: it flies at their head, bonks, and rolls away. */
    coin(from, to) {
      avatarOf(from)?.aim("flick", () => headOf(to));
      stage.after(FLICK_RELEASE, () => {
        const coin = makeCoin();
        const start = handOf(from, inView(0.15, -0.2, -0.3));
        coin.position.copy(start);
        scene.add(coin);
        flights.add({
          obj: coin,
          from: start,
          to: () => headOf(to),
          t: 0,
          dur: 0.55,
          arc: 0.35,
          spin: 25,
          done: () => {
            audio.bonk();
            avatarOf(to)?.play("bonked");
            hit(to, "coin");
            const bounce = coin.position.clone();
            const away = bounce
              .clone()
              .add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 0, (Math.random() - 0.5) * 0.8))
              .setY(layout.table.y + 0.01);
            flights.add({
              obj: coin,
              from: bounce,
              to: away,
              t: 0,
              dur: 0.5,
              arc: 0.25,
              spin: 12,
              done: () => stage.after(1.5, () => scene.remove(coin)),
            });
          },
        });
      });
    },

    /** A paper plane: it loops its way over, bops them on the head and comes down on the felt in front of them. */
    plane(from, to) {
      avatarOf(from)?.aim("throw", () => headOf(to));
      stage.after(THROW_RELEASE, () => {
        const plane = makePlane();
        const start = handOf(from, inView(0.18, -0.12, -0.35));
        plane.position.copy(start);
        scene.add(plane);
        audio.whoosh();
        flights.add({
          obj: plane,
          from: start,
          to: () => headOf(to),
          t: 0,
          dur: 1.5,
          arc: 0.25,
          spin: 0,
          nose: true,
          loop: 0.75,
          done: () => {
            audio.tap();
            avatarOf(to)?.play("bopped");
            hit(to, "plane");
            // it drops onto the felt in front of them, and lies there a while
            const seat = deps.seat(to)?.avatar.group.position;
            const land = new THREE.Vector3(
              (seat?.x ?? 0) * 0.72 + (Math.random() - 0.5) * 0.25,
              layout.table.y + 0.02,
              (seat?.z ?? 0) * 0.72 + (Math.random() - 0.5) * 0.25,
            );
            flights.add({
              obj: plane,
              from: plane.position.clone(),
              to: land,
              t: 0,
              dur: 0.7,
              arc: 0.12,
              spin: 0,
              nose: true,
              done: () => {
                plane.rotation.set(0, Math.random() * Math.PI * 2, 0.5);
                stage.after(PLANE_RESTS, () => scene.remove(plane));
              },
            });
          },
        });
      });
    },

    /** A spitball through a straw: fast and flat, and it sticks to their face for a while. */
    spitball(from, to) {
      avatarOf(from)?.aim("blow", () => headOf(to));
      stage.after(BLOW_RELEASE, () => {
        const ball = makeSpitball();
        // out of the end of the straw: under your nose for your own, the bean's mouth for everyone else's
        const mouth = avatarOf(from)?.anchor("mouth");
        const start = isMe(from) || !mouth ? inView(0, -0.1, -0.3) : mouth.localToWorld(new THREE.Vector3(0, 0, 0.2));
        ball.position.copy(start);
        scene.add(ball);
        audio.spit();
        flights.add({
          obj: ball,
          from: start,
          to: () =>
            isMe(to) ? eyes() : (avatarOf(to)?.anchor("nose").getWorldPosition(new THREE.Vector3()) ?? eyes()),
          t: 0,
          dur: 0.3,
          arc: 0.05,
          spin: 0,
          done: () => {
            audio.splat();
            avatarOf(to)?.play("splatted");
            hit(to, "spitball");
            const face = isMe(to) ? undefined : avatarOf(to)?.anchor("nose");
            // on your own face it's the screens' to show (you can't see your face)
            if (!face) return void scene.remove(ball);
            face.add(ball);
            ball.position.set((Math.random() - 0.5) * 0.2, -0.02 + Math.random() * 0.14, 0.02);
            ball.scale.set(1.5, 1.5, 0.6);
            stage.after(SPITBALL_STICKS, () => ball.removeFromParent());
          },
        });
      });
    },
  };

  return { play: (from, item, to) => PLAYS[item](from, to) };
}
