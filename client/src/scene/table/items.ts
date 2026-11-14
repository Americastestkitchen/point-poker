// What using a hand item on someone looks like at the table: the bean's arm does its move with
// the item in its hand, something swings or flies across, there's a sound, and whoever it was
// for takes the hit. An emote that answers someone's flies over to them the same way.
// Nothing here changes the game: it plays what the server says just happened.
import * as THREE from "three";
import type { ItemId } from "../../../../shared/catalog/items.ts";
import type { Events } from "../../app/events.ts";
import type { Audio } from "../../audio/sfx.ts";
import { BONK_HIT, FLICK_RELEASE, THROW_RELEASE } from "../../avatar/animator.ts";
import { makePlane } from "../../avatar/parts/props.ts";
import { dropEmoji, emojiBubble } from "../../avatar/parts/labels.ts";
import type { Stage } from "../engine/stage.ts";
import type { Layout } from "../layout/layout.ts";
import type { Flights } from "./flights.ts";
import { makeChip } from "./chips.ts";
import type { Seat } from "./seat.ts";

export interface ItemPlays {
  /** `from` used `item` on `to`. */
  play(from: string, item: ItemId, to: string): void;
  /** `from`'s emote was for `to`: the emoji flies over from one to the other. */
  toss(from: string, emoji: string, to: string): void;
}

/** The colours a flicked chip comes in: one at random each flick. */
const FLICK_COLORS = ["#c0392b", "#2d6cdf", "#151515", "#e6be5a"] as const;
const flickColor = () => FLICK_COLORS[Math.floor(Math.random() * FLICK_COLORS.length)] ?? FLICK_COLORS[0];

/** How long a landed paper plane lies on the felt (seconds). */
const PLANE_RESTS = 6;
/** How long an emoji that flew over to someone hangs over their head (seconds). */
const EMOJI_LINGERS = 0.9;

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
  /** You took one: the screens show it (a flash, a shake). */
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

    /** A chip off the thumb, a different colour each time: it flies at their head, bonks, and rolls away. */
    chip(from, to) {
      avatarOf(from)?.aim("flick", () => headOf(to));
      stage.after(FLICK_RELEASE, () => {
        const chip = makeChip(flickColor());
        const start = handOf(from, inView(0.15, -0.2, -0.3));
        chip.position.copy(start);
        scene.add(chip);
        flights.add({
          obj: chip,
          from: start,
          to: () => headOf(to),
          t: 0,
          dur: 0.55,
          arc: 0.35,
          spin: 25,
          done: () => {
            audio.bonk();
            avatarOf(to)?.play("bonked");
            hit(to, "chip");
            const bounce = chip.position.clone();
            const away = bounce
              .clone()
              .add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 0, (Math.random() - 0.5) * 0.8))
              .setY(layout.table.y + 0.01);
            flights.add({
              obj: chip,
              from: bounce,
              to: away,
              t: 0,
              dur: 0.5,
              arc: 0.25,
              spin: 12,
              done: () => stage.after(1.5, () => scene.remove(chip)),
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
  };

  return {
    play: (from, item, to) => PLAYS[item](from, to),
    toss(from, emoji, to) {
      const bubble = emojiBubble(emoji);
      const over = (id: string) => headOf(id).add(new THREE.Vector3(0, isMe(id) ? 0 : 0.45, 0));
      const start = over(from);
      bubble.position.copy(start);
      scene.add(bubble);
      flights.add({
        obj: bubble,
        from: start,
        to: () => over(to),
        t: 0,
        dur: 0.8,
        arc: 0.6,
        spin: 0,
        done: () => {
          audio.pop();
          avatarOf(to)?.play("noticed");
          // it hangs over them a moment (on your own screen it's flown into your face: it's gone)
          stage.after(isMe(to) ? 0 : EMOJI_LINGERS, () => dropEmoji(bubble));
        },
      });
    },
  };
}
