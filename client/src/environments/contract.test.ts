// What every room has to do, checked for each one in the catalog: its props
// stand on their anchors at a sensible size, the squeaky squeaks, it stays
// within the light budget, and taking it down leaves nothing behind.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import * as THREE from "three";
import { ENVIRONMENTS } from "../../../shared/catalog/environments.ts";
import type { RoomSound } from "../audio/sfx.ts";
import { isSharedTexture } from "../scene/art/materials.ts";
import { layout } from "../scene/layout/layout.ts";
import { loadEnvironment } from "./index.ts";
import { mountEnvironment } from "./mount.ts";

// Rooms draw their textures on canvases; node has none, so each gets one that takes any drawing and keeps nothing.
function fakeCanvas() {
  const canvas = { width: 0, height: 0, getContext: () => g };
  const ignore = function () {};
  const g: object = new Proxy(ignore, {
    get: (_, key) =>
      key === "canvas" ? canvas : key === "measureText" ? (text: string) => ({ width: text.length * 10 }) : g,
    set: () => true,
    apply: () => g,
  });
  return canvas;
}
Object.assign(globalThis, { document: { createElement: fakeCanvas }, Path2D: function Path2D() {} });

/** How big each prop may be (metres, its longest side), so it stays out of the cards' way. */
const BUDGET = { statusScreen: 2, sign: 3, squeaky: 0.35 } as const;
/** Every point and spot light costs every material on screen; only one may cast shadows. */
const MAX_LIGHTS = 6;

function mount(env: Awaited<ReturnType<typeof loadEnvironment>>) {
  const picks = new Map<THREE.Object3D, () => void>();
  const frames = new Set<(dt: number, t: number) => void>();
  const sounds = { played: 0, beds: 0, disposed: false, squeaked: 0 };
  const sound: RoomSound = {
    tone: () => void sounds.played++,
    noise: () => void sounds.played++,
    bed: () => void sounds.beds++,
    dispose: () => void (sounds.disposed = true),
  };
  const mounted = mountEnvironment(env, {
    anchors: layout.anchors,
    sound: () => sound,
    pick(object, onPick) {
      picks.set(object, onPick);
      return () => picks.delete(object);
    },
    onFrame(fn) {
      frames.add(fn);
      return () => frames.delete(fn);
    },
    squeaked: () => void sounds.squeaked++,
  });
  const run = (seconds: number) => {
    for (let t = 0; t < seconds; t += 1 / 60) for (const fn of frames) fn(1 / 60, t);
  };
  return { mounted, picks, frames, sounds, run };
}

/** Everything a room holds on the GPU, each with a flag that flips when it's freed. */
function gpuData(root: THREE.Object3D, extra: THREE.Material[]) {
  const all = new Set<THREE.EventDispatcher<{ dispose: object }>>();
  const addMaterial = (m: THREE.Material) => {
    all.add(m);
    const values: unknown[] = Object.values(m);
    for (const v of values) if (v instanceof THREE.Texture && !isSharedTexture(v)) all.add(v);
  };
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh || o instanceof THREE.Points)) return;
    const mesh: THREE.Mesh | THREE.Points = o;
    all.add(mesh.geometry);
    for (const m of [mesh.material].flat()) addMaterial(m);
  });
  for (const m of extra) addMaterial(m);
  const freed = new Set<object>();
  for (const thing of all) thing.addEventListener("dispose", () => freed.add(thing));
  return { count: all.size, freed: () => freed.size };
}

test("every room in the catalog has a folder, and every folder is in the catalog", () => {
  const folders = readdirSync(import.meta.dirname, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== "kit")
    .map((e) => e.name);
  assert.deepEqual(folders.toSorted(), ENVIRONMENTS.map((e) => e.id).toSorted());
});

for (const { id, name } of ENVIRONMENTS) {
  test(`${name}: every prop stands on its anchor, at a sensible size`, async () => {
    const { mounted } = mount(await loadEnvironment(id));
    for (const key of ["statusScreen", "sign", "squeaky"] as const) {
      const { object } = mounted.props[key];
      const anchor = layout.anchors[key];
      assert.equal(object.parent, mounted.root, `${key} is in the room`);
      assert.deepEqual(object.position.toArray(), [anchor.position.x, anchor.position.y, anchor.position.z], key);
      assert.equal(object.rotation.y, anchor.yaw, `${key} faces its anchor's way`);
      const size = new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3());
      assert.ok(Math.max(size.x, size.y, size.z) <= BUDGET[key], `${key} is ${size.toArray().join(" × ")}`);
    }
  });

  test(`${name}: the squeaky squeaks when clicked, and the room runs`, async () => {
    const { mounted, picks, sounds, run } = mount(await loadEnvironment(id));
    const click = picks.get(mounted.props.squeaky.object);
    assert.ok(click, "the squeaky is clickable");
    click();
    assert.ok(sounds.played > 0, "it made a noise");
    assert.equal(sounds.squeaked, 1, "everyone else hears about it");
    mounted.props.squeaky.squeak(); // someone else's click: it plays here without telling anyone
    assert.equal(sounds.squeaked, 1);
    mounted.props.statusScreen.show("SD-1", "Make the button blue", "3 of 5 voted");
    run(5);
  });

  test(`${name}: stays within the light budget`, async () => {
    const { mounted } = mount(await loadEnvironment(id));
    let lights = 0;
    let shadows = 0;
    mounted.root.traverse((o) => {
      if (o instanceof THREE.PointLight || o instanceof THREE.SpotLight) lights++;
      if (o instanceof THREE.Light && o.castShadow) shadows++;
    });
    assert.ok(lights <= MAX_LIGHTS, `${lights} point and spot lights`);
    assert.ok(shadows <= 1, `${shadows} lights cast shadows`);
  });

  test(`${name}: taking it down leaves nothing behind`, async () => {
    const { mounted, picks, frames, sounds, run } = mount(await loadEnvironment(id));
    run(1);
    const { felt, wood, trim, base } = mounted.tableMaterials;
    const gpu = gpuData(mounted.root, [felt, wood, trim, base]);
    mounted.dispose();
    assert.equal(gpu.freed(), gpu.count, "every geometry, material and texture was freed");
    assert.equal(picks.size, 0, "nothing is clickable");
    assert.equal(frames.size, 0, "nothing runs per frame");
    assert.ok(sounds.disposed, "its sound is gone");
  });
}
