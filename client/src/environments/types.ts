// What an environment is: the room around the table. It decides how things
// look; `layout` decides where they go, so the game plays the same everywhere.
// A room only builds things, from what it's handed (EnvCtx). mount.ts puts its
// props on their anchors, wires their clicks, and throws it all away after.
import type * as THREE from "three";
import type { RoomSound } from "../audio/sfx.ts";
import type { Layout } from "../scene/layout/layout.ts";

/** Shows the ticket and how the round is going (the Basement's telly). */
export interface StatusScreen {
  readonly object: THREE.Object3D;
  show(title: string, subtitle: string, status: string): void;
}

/** The big sign behind the table. */
export interface Sign {
  readonly object: THREE.Object3D;
}

/** Something on the felt that squeaks when clicked (the Basement's rubber duck). */
export interface Squeaky {
  readonly object: THREE.Object3D;
  /** Its noise and its little dance; mount.ts calls it when someone clicks it. */
  squeak(): void;
}

/** The table is the same shape everywhere; only what it's made of changes. */
export interface TableMaterials {
  felt: THREE.Material;
  /** The table's edge and skirt. */
  wood: THREE.Material;
  /** The padded rim. */
  trim: THREE.Material;
  /** The pedestal. */
  base: THREE.Material;
}

/** Everything in a room that isn't a prop: walls, floor, lights, scenery. */
export interface Backdrop {
  object: THREE.Object3D;
  background: THREE.Color;
  fog: THREE.Fog | null;
  /** How bright the camera sees the room (tone mapping exposure); the stage's default if left out. */
  exposure?: number;
}

/** What a room is handed to build with. Everything it registers here goes when the room does. */
export interface EnvCtx {
  /** Where the props go. They're placed for you; use these to line other things up with them (the Basement's lamp). */
  anchors: Layout["anchors"];
  /** The room's own sounds, which fade out with it. */
  sound: RoomSound;
  /** Makes `object` clickable, for easter eggs. */
  pick(object: THREE.Object3D, onPick: () => void): void;
  /** Runs `fn` every frame while the room is up. */
  onFrame(fn: (dt: number, t: number) => void): void;
}

/** Builds one prop at the origin, facing +z; mount.ts turns it to face its anchor's way and moves it there. */
export type Prop<P> = (ctx: EnvCtx) => P;

export interface Environment {
  backdrop(ctx: EnvCtx): Backdrop;
  tableMaterials(ctx: EnvCtx): TableMaterials;
  /** Same job in every room, different look. A room can reuse one from kit/props/. */
  props: { statusScreen: Prop<StatusScreen>; sign: Prop<Sign>; squeaky: Prop<Squeaky> };
}
