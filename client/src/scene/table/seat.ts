// One place at the table: the bean in its chair, their card on the felt and
// their chip stack. Seats glide to new spots as people come and go.
import * as THREE from "three";
import type { PublicPlayer } from "../../../../shared/protocol.ts";
import { createAvatar, type Avatar } from "../../avatar/avatar.ts";
import type { Stage } from "../engine/stage.ts";
import type { Layout } from "../layout/layout.ts";
import { createTableCard, type TableCard } from "./card.ts";
import { stackChips } from "./chips.ts";

export interface Seat {
  readonly avatar: Avatar;
  readonly card: TableCard;
  /** Moves the seat to its spot for this table size; the bean glides there (the first time, it's just there). */
  place(slot: number, count: number, mine: boolean): void;
  /** Restacks the chips if the amount changed. */
  showChips(amount: number, seed: number): void;
  /** Where winnings fly to. */
  stackPosition(out?: THREE.Vector3): THREE.Vector3;
  update(dt: number, t: number): void;
  /** Takes the seat off the table. */
  remove(): void;
}

export function createSeat(stage: Stage, player: PublicPlayer, deps: { layout: Layout; onPick?: () => void }): Seat {
  const { layout, onPick } = deps;
  const avatar = createAvatar(player.look, { dealer: player.isDealer });
  const card = createTableCard(stage.scene, layout);
  const stack = new THREE.Group();
  stage.scene.add(avatar.group, stack);
  const unpick = onPick ? stage.picking.register(avatar.hitbox, onPick) : () => {};
  const pos = new THREE.Vector3();
  let facing = 0;
  let placed = false;
  let chipsShown = -1;

  return {
    avatar,
    card,

    place(slot, count, mine) {
      const s = layout.seat(slot, count);
      pos.set(s.x, 0, s.z);
      facing = s.facing;
      if (!placed) {
        avatar.group.position.copy(pos);
        avatar.group.rotation.y = facing;
        placed = true;
      }
      card.placeAt(slot, count, mine);
      card.noFloat = mine;
      const p = layout.stack(slot, count);
      stack.position.set(p.x, p.y, p.z);
    },

    showChips(amount, seed) {
      if (amount === chipsShown) return;
      stackChips(stack, amount, seed);
      chipsShown = amount;
    },

    stackPosition: (out = new THREE.Vector3()) => stack.getWorldPosition(out),

    update(dt, t) {
      avatar.group.position.lerp(pos, Math.min(1, dt * 4));
      let dr = facing - avatar.group.rotation.y;
      dr = Math.atan2(Math.sin(dr), Math.cos(dr));
      avatar.group.rotation.y += dr * Math.min(1, dt * 4);
      avatar.update(dt, t);
      card.update(dt);
    },

    remove() {
      stage.scene.remove(avatar.group, card.group, stack);
      unpick();
    },
  };
}
