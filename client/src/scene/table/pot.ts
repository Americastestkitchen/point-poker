// The pot in the middle of the table: chips drop in on the reveal and fly out
// to the winners on the settle.
import * as THREE from "three";
import type { Phase } from "../../../../shared/protocol.ts";
import type { Audio } from "../../audio/sfx.ts";
import type { Stage } from "../engine/stage.ts";
import { layout } from "../layout/layout.ts";
import { stackChips } from "./chips.ts";
import type { Flights } from "./flights.ts";

/** What's in the pot. `payingOut` lasts until the last chip lands on a winner's stack. */
export type PotState = "empty" | "full" | "payingOut";

/** What the pot should do for a new view of the round. */
export type PotMove = "fill" | "payOut" | "clear";

/**
 * The pot's rules: it fills when the cards go up (or when you arrive mid-reveal),
 * pays out when the dealer first calls it, and empties when a new vote starts or
 * the call changes (the chips already went out the first time).
 */
export function potMove(
  state: PotState,
  round: { phase: Phase; revealedNow: boolean; settledNow: boolean; resettled: boolean },
): PotMove | null {
  if (round.phase === "revealed") return round.revealedNow || state === "empty" ? "fill" : null;
  if (round.settledNow && !round.resettled) return "payOut";
  if (round.phase !== "settled" || round.resettled) return state === "empty" ? null : "clear";
  return null;
}

export interface Pot {
  readonly state: PotState;
  /** Stacks `amount` in the pot, the chips dropping in one after another. */
  fill(amount: number): void;
  /** Every chip flies to one of `to` (they take turns); `landed` runs once they're all there. */
  payOut(to: { stackPosition(out?: THREE.Vector3): THREE.Vector3 }[], landed: () => void): void;
  clear(): void;
}

export function createPot(stage: Stage, deps: { flights: Flights; audio: Audio }): Pot {
  const { flights, audio } = deps;
  const group = new THREE.Group();
  const p = layout.anchors.pot.position;
  group.position.set(p.x, p.y, p.z);
  stage.scene.add(group);
  let state: PotState = "empty";

  return {
    get state() { return state; },

    fill(amount) {
      state = "full";
      stackChips(group, amount, 99);
      group.children.forEach((c, i) => {
        const to = c.position.clone();
        c.position.y += 0.6 + i * 0.01;
        flights.add({ obj: c, from: c.position.clone(), to, t: -i * 0.03, dur: 0.35, arc: 0, spin: 0, done: () => i % 3 === 0 && audio.chip() });
      });
    },

    payOut(to, landed) {
      const chips = [...group.children];
      if (!to.length) { group.clear(); state = "empty"; return; }
      state = "payingOut";
      chips.forEach((chip, i) => {
        const winner = to[i % to.length];
        const from = chip.getWorldPosition(new THREE.Vector3());
        group.remove(chip);
        stage.scene.add(chip);
        chip.position.copy(from);
        flights.add({
          obj: chip, from, to: () => winner.stackPosition().setY(layout.table.y + 0.05),
          t: -0.6 - i * 0.04, dur: 0.6, arc: 0.4, spin: 8,
          done: () => { stage.scene.remove(chip); if (i % 2 === 0) audio.chip(); },
        });
      });
      const total = 0.6 + chips.length * 0.04 + 0.7;
      setTimeout(() => {
        // unless a new round has refilled it meanwhile
        if (state === "payingOut") state = "empty";
        landed();
      }, total * 1000);
    },

    clear() { group.clear(); state = "empty"; },
  };
}
