import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import type { RoomSound } from "../audio/sfx.ts";
import type { Environment } from "../environments/types.ts";
import { layout } from "./layout/layout.ts";
import { createRoom } from "./room.ts";

type Id = "attic" | "boat" | "cave";

/** A room that builds a few named groups and reports what its screen shows. */
function fakeRoom(id: Id, log: string[]): Environment {
  const named = (what: string) => Object.assign(new THREE.Group(), { name: `${id} ${what}` });
  return {
    backdrop: ({ onFrame }) => {
      onFrame(() => {});
      return { object: named("backdrop"), background: new THREE.Color(), fog: null };
    },
    tableMaterials: () => ({
      felt: new THREE.MeshBasicMaterial({ name: id }),
      wood: new THREE.MeshBasicMaterial(),
      trim: new THREE.MeshBasicMaterial(),
      base: new THREE.MeshBasicMaterial(),
    }),
    props: {
      statusScreen: () => ({ object: named("screen"), show: (title) => log.push(`${id} shows ${title}`) }),
      sign: () => ({ object: named("sign") }),
      squeaky: () => ({ object: named("squeaky"), squeak: () => log.push(`${id} squeaks`) }),
    },
  };
}

/** `slowCurtain`: the curtain takes until `drop()` is called to fall. */
function setup({ slowCurtain = false } = {}) {
  const log: string[] = [];
  const frames = new Set<(dt: number, t: number) => void>();
  const picks = new Set<THREE.Object3D>();
  const sounds = { live: 0 };
  const pending = new Map<Id, { resolve(): void; reject(e: Error): void }>();
  const falling: (() => void)[] = [];
  const sound = (): RoomSound => {
    sounds.live++;
    return { tone() {}, noise() {}, bed() {}, dispose: () => void sounds.live-- };
  };
  const room = createRoom<Id>({
    load: (id) =>
      new Promise((resolve, reject) => {
        log.push(`load ${id}`);
        pending.set(id, { resolve: () => resolve(fakeRoom(id, log)), reject });
      }),
    mount: {
      anchors: layout.anchors,
      sound,
      pick(object) {
        picks.add(object);
        return () => picks.delete(object);
      },
      onFrame(fn) {
        frames.add(fn);
        return () => frames.delete(fn);
      },
      squeaked: () => log.push("told everyone"),
    },
    stage: {
      add: (o) => log.push(`add ${o.children.map((c) => c.name).find((n) => n.endsWith("backdrop"))}`),
      remove: (o) => log.push(`remove ${o.children.map((c) => c.name).find((n) => n.endsWith("backdrop"))}`),
      look: () => {},
    },
    table: { setMaterials: (m) => log.push(`table ${m.felt.name}`) },
    curtain: {
      to: (o) => {
        log.push(`curtain ${o}`);
        return slowCurtain && o === 1 ? new Promise<void>((r) => falling.push(r)) : Promise.resolve();
      },
    },
    failed: (id) => log.push(`failed ${id}`),
  });
  /** Lets every promise that can settle, settle. */
  const flush = () => new Promise((r) => setImmediate(r));
  const arrive = async (id: Id) => {
    pending.get(id)?.resolve();
    await flush();
  };
  /** How many rooms are still mounted: their frames, clicks and sound channels. */
  const alive = () => ({ frames: frames.size, picks: picks.size, sounds: sounds.live });
  const drop = async () => {
    for (const fall of falling.splice(0)) fall();
    await flush();
  };
  return { room, log, pending, flush, arrive, drop, alive };
}

const ONE_ROOM = { frames: 1, picks: 1, sounds: 1 };

test("the first room goes straight up; a move drops the curtain, swaps and lifts it", async () => {
  const { room, log, arrive, alive } = setup();
  void room.show("attic");
  await arrive("attic");
  assert.deepEqual(log, ["load attic", "add attic backdrop", "table attic", "curtain 0"]);
  log.length = 0;
  void room.show("boat");
  await arrive("boat");
  assert.deepEqual(log, [
    "load boat",
    "curtain 1",
    "remove attic backdrop",
    "add boat backdrop",
    "table boat",
    "curtain 0",
  ]);
  assert.deepEqual(alive(), ONE_ROOM, "the attic is gone");
});

test("quick moves end up in the last room asked for, with nothing else left running", async () => {
  const { room, log, arrive, alive } = setup();
  void room.show("attic");
  await arrive("attic");
  void room.show("boat");
  void room.show("cave");
  await arrive("cave");
  await arrive("boat"); // the boat turns up late, and is thrown away
  assert.ok(log.includes("add cave backdrop"));
  assert.ok(!log.includes("add boat backdrop"));
  assert.deepEqual(alive(), ONE_ROOM);
});

test("asking for a room twice loads it once, and the screen's last lines follow into the new room", async () => {
  const { room, log, arrive, alive } = setup();
  void room.show("attic");
  await arrive("attic");
  void room.show("boat");
  room.screen.show("SD-1", "", ""); // while the boat loads
  const boat = room.show("boat"); // asking again changes nothing
  void room.show("cave");
  await arrive("boat");
  await arrive("cave");
  await boat;
  assert.equal(log.filter((l) => l === "load boat").length, 1);
  assert.ok(!log.includes("add boat backdrop"));
  assert.deepEqual(alive(), ONE_ROOM);
  assert.ok(log.includes("cave shows SD-1"), "the new room shows what the screen last said");
});

test("a room built while the curtain was falling, but no longer wanted, is taken down", async () => {
  const { room, log, arrive, drop, alive } = setup({ slowCurtain: true });
  void room.show("attic");
  await arrive("attic");
  void room.show("boat");
  await arrive("boat"); // built, waiting on the curtain
  void room.show("cave");
  await drop();
  assert.ok(!log.includes("add boat backdrop"));
  await arrive("cave");
  await drop();
  assert.ok(log.includes("add cave backdrop"));
  assert.deepEqual(alive(), ONE_ROOM);
});

test("going back before a move finishes calls it off", async () => {
  const { room, log, arrive, alive } = setup();
  void room.show("attic");
  await arrive("attic");
  void room.show("boat");
  void room.show("attic");
  await arrive("boat");
  assert.ok(!log.includes("remove attic backdrop"));
  assert.deepEqual(alive(), ONE_ROOM);
});

test("a room that doesn't load leaves the table where it is, and can be tried again", async () => {
  const { room, log, pending, flush, arrive, alive } = setup();
  void room.show("attic");
  await arrive("attic");
  void room.show("boat");
  pending.get("boat")?.reject(new Error("offline"));
  await flush();
  assert.ok(log.includes("failed boat"));
  assert.ok(!log.includes("remove attic backdrop"));
  assert.deepEqual(alive(), ONE_ROOM);
  void room.show("boat");
  await arrive("boat");
  assert.ok(log.includes("add boat backdrop"));
});

test("someone else's squeak plays in whichever room is up", async () => {
  const { room, log, arrive } = setup();
  room.squeak(); // no room yet: nothing to squeak
  void room.show("attic");
  await arrive("attic");
  void room.show("boat");
  await arrive("boat");
  log.length = 0;
  room.squeak();
  assert.deepEqual(log, ["boat squeaks"], "and it doesn't tell everyone again");
});
