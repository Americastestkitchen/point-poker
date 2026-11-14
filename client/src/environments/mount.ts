// Puts a room up: hands it what it builds with, places its props on their
// anchors, wires the squeaky's click, and takes it all down again. A room only
// builds; everything it registers goes through here, so dispose() leaves nothing behind.
import * as THREE from "three";
import type { RoomSound } from "../audio/sfx.ts";
import type { Anchor, Layout } from "../scene/layout/layout.ts";
import { disposeMaterial, disposeTree } from "./kit/dispose.ts";
import type { EnvCtx, Environment, Sign, Squeaky, StatusScreen, TableMaterials } from "./types.ts";

export interface MountDeps {
  anchors: Layout["anchors"];
  /** A fresh sound channel for the room. */
  sound(): RoomSound;
  /** Makes something clickable; returns how to undo it. */
  pick(object: THREE.Object3D, onPick: () => void): () => void;
  /** Runs `fn` every frame; returns how to stop it. */
  onFrame(fn: (dt: number, t: number) => void): () => void;
  /** You clicked the squeaky, after it squeaked (your bean pokes it). */
  squeaked(): void;
}

export interface MountedEnvironment {
  /** The backdrop and the props, ready to add to the scene. */
  readonly root: THREE.Object3D;
  readonly background: THREE.Color;
  readonly fog: THREE.Fog | null;
  readonly exposure: number | undefined;
  readonly tableMaterials: TableMaterials;
  readonly props: { readonly statusScreen: StatusScreen; readonly sign: Sign; readonly squeaky: Squeaky };
  /** Stops its sounds, frames and clicks and frees what it put on the GPU. Take `root` off the stage first. */
  dispose(): void;
}

export function mountEnvironment(env: Environment, deps: MountDeps): MountedEnvironment {
  const undo: (() => void)[] = [];
  const sound = deps.sound();
  const ctx: EnvCtx = {
    anchors: deps.anchors,
    sound,
    pick: (object, onPick) => void undo.push(deps.pick(object, onPick)),
    onFrame: (fn) => void undo.push(deps.onFrame(fn)),
  };
  const root = new THREE.Group();
  const release = () => {
    for (const fn of undo) fn();
    sound.dispose();
    disposeTree(root);
  };

  let built: ReturnType<typeof build>;
  try {
    built = build(env, ctx, root, deps.squeaked);
  } catch (error) {
    release(); // a room that breaks halfway leaves nothing running
    throw error;
  }
  const { backdrop, tableMaterials, props } = built;
  let disposed = false;
  return {
    root,
    background: backdrop.background,
    fog: backdrop.fog,
    exposure: backdrop.exposure,
    tableMaterials,
    props,
    dispose() {
      if (disposed) return;
      disposed = true;
      release();
      const { felt, wood, trim, base } = tableMaterials;
      for (const m of [felt, wood, trim, base]) disposeMaterial(m);
    },
  };
}

/** Builds the room into `root`: its backdrop, and each prop on its anchor with the squeaky clickable. */
function build(env: Environment, ctx: EnvCtx, root: THREE.Group, squeaked: () => void) {
  const backdrop = env.backdrop(ctx);
  root.add(backdrop.object);
  const tableMaterials = env.tableMaterials(ctx);
  const place = <P extends { readonly object: THREE.Object3D }>(prop: P, anchor: Anchor): P => {
    const { x, y, z } = anchor.position;
    prop.object.position.set(x, y, z);
    prop.object.rotation.set(0, anchor.yaw, 0);
    root.add(prop.object);
    return prop;
  };
  const { anchors } = ctx;
  const props = {
    statusScreen: place(env.props.statusScreen(ctx), anchors.statusScreen),
    sign: place(env.props.sign(ctx), anchors.sign),
    squeaky: place(env.props.squeaky(ctx), anchors.squeaky),
  };
  ctx.pick(props.squeaky.object, () => {
    props.squeaky.squeak();
    squeaked();
  });
  return { backdrop, tableMaterials, props };
}
