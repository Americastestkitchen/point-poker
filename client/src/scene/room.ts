// The room around the table, which can change mid-game. The next room is built
// out of sight; the curtain drops, the rooms swap in one frame, and it lifts on
// the new one. The table, the seats, the cards and the camera never move.
import type * as THREE from "three";
import { mountEnvironment, type MountDeps, type MountedEnvironment } from "../environments/mount.ts";
import type { Environment, StatusScreen, TableMaterials } from "../environments/types.ts";
import type { Curtain } from "./engine/curtain.ts";

/** How long the curtain takes to drop, and to lift (seconds). */
export const CURTAIN = { drop: 0.35, lift: 0.6 } as const;

/** `Id` is a room id (EnvironmentId in the game). */
export interface RoomDeps<Id extends string> {
  load(id: Id): Promise<Environment>;
  mount: MountDeps;
  stage: {
    add(object: THREE.Object3D): void;
    remove(object: THREE.Object3D): void;
    /** Sets the backdrop's sky, fog and brightness. */
    look(look: Pick<MountedEnvironment, "background" | "fog" | "exposure">): void;
  };
  table: { setMaterials(mats: TableMaterials): void };
  curtain: Curtain;
  /** A room didn't load; the table stays where it is. */
  failed(id: Id, error: unknown): void;
}

export interface Room<Id extends string> {
  /** The status screen, whichever room is up: it shows the last lines in every new room too. */
  readonly screen: Pick<StatusScreen, "show">;
  /** Moves to `id`. If it's called again before that's done, the latest call wins. */
  show(id: Id): Promise<void>;
}

export function createRoom<Id extends string>(deps: RoomDeps<Id>): Room<Id> {
  let current: { id: Id; env: MountedEnvironment } | null = null;
  /** Where we're going (or are). */
  let wanted: Id | null = null;
  let lines: [string, string, string] | null = null;
  /** Where we are now. */
  const here = () => current?.id ?? null;

  function swapIn(id: Id, next: MountedEnvironment) {
    const old = current;
    if (old) deps.stage.remove(old.env.root);
    deps.stage.add(next.root);
    deps.stage.look(next);
    deps.table.setMaterials(next.tableMaterials);
    current = { id, env: next };
    old?.env.dispose();
  }

  return {
    screen: {
      show(...shown) {
        lines = shown;
        current?.env.props.statusScreen.show(...shown);
      },
    },
    async show(id) {
      if (id === wanted) return;
      wanted = id;
      if (id === here()) {
        // back where we are before a move finished: call the move off
        void deps.curtain.to(0, CURTAIN.lift);
        return;
      }
      const stale = () => wanted !== id;
      let next: MountedEnvironment;
      try {
        const env = await deps.load(id);
        if (stale()) return;
        next = mountEnvironment(env, deps.mount);
      } catch (error) {
        if (stale()) return;
        // stay put, and let a later move back here try again
        wanted = here();
        void deps.curtain.to(0, CURTAIN.lift);
        deps.failed(id, error);
        return;
      }
      if (lines) next.props.statusScreen.show(...lines);
      if (current) await deps.curtain.to(1, CURTAIN.drop);
      if (stale()) {
        next.dispose();
        return;
      }
      swapIn(id, next);
      void deps.curtain.to(0, CURTAIN.lift);
    },
  };
}
