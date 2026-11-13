// What an environment is: the room around the table. It decides how things
// look; `layout` decides where they go, so the game plays the same everywhere.
import type * as THREE from "three";
import type { AmbienceId, Audio } from "../audio/sfx.ts";
import type { Layout } from "../scene/layout/layout.ts";
import type { Picking } from "../scene/engine/picking.ts";

/** Shows the ticket and how the round is going (the Basement's telly). */
export interface StatusScreen {
  readonly object: THREE.Object3D;
  show(title: string, subtitle: string, status: string): void;
}

/** The big sign behind the table. */
export interface Sign {
  readonly object: THREE.Object3D;
}

/** Something on the felt that squeaks when clicked (the Basement's rubber duck). It registers its own click. */
export interface Squeaky {
  readonly object: THREE.Object3D;
  squeak(): void;
}

export interface BuiltEnvironment {
  root: THREE.Object3D;
  background: THREE.Color;
  fog: THREE.Fog | null;
  /** The table is the same shape everywhere; only what it's made of changes. */
  tableMaterials: {
    felt: THREE.Material;
    /** The table's edge and skirt. */
    wood: THREE.Material;
    /** The padded rim. */
    trim: THREE.Material;
    /** The pedestal. */
    base: THREE.Material;
  };
  /** Same job in every environment, different look. */
  props: { statusScreen: StatusScreen; sign: Sign; squeaky: Squeaky };
  ambience: AmbienceId;
  update(dt: number, t: number): void;
  dispose(): void;
}

export interface Environment {
  build(ctx: { layout: Layout; audio: Audio; picking: Picking }): Promise<BuiltEnvironment>;
}
