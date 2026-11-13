// Pins the table layout to where things were before environments split off,
// so nothing on the table moves by accident.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { layout, type Vec3 } from "./layout.ts";

type Pinned = Record<"seats" | "cards" | "myCards" | "stacks" | "cameras", Record<string, number[]>>;
const pinned: Pinned = JSON.parse(readFileSync(join(import.meta.dirname, "layout.pinned.json"), "utf8"));

const near = (actual: number[], expected: number[], what: string) => {
  assert.equal(actual.length, expected.length, what);
  actual.forEach((a, i) => assert.ok(Math.abs(a - expected[i]) < 1e-8, `${what}: ${actual} vs ${expected}`));
};
const xyz = (v: Vec3) => [v.x, v.y, v.z];
const seats = Object.keys(pinned.seats).map((k) => { const [slot, count] = k.split("/").map(Number); return { k, slot, count }; });

test("seats sit where they always have, for every table size", () => {
  assert.equal(seats.length, 44);
  for (const { k, slot, count } of seats) {
    const s = layout.seat(slot, count);
    near([s.x, s.z, s.facing], pinned.seats[k], `seat ${k}`);
  }
});

test("cards, chip stacks and cameras haven't moved", () => {
  for (const { k, slot, count } of seats) {
    const c = layout.card(slot, count, false);
    near([...xyz(c.position), c.yaw], pinned.cards[k], `card ${k}`);
    near(xyz(layout.card(slot, count, true).position), pinned.myCards[k], `my card ${k}`);
    near(xyz(layout.stack(slot, count)), pinned.stacks[k], `stack ${k}`);
    const s = layout.seat(slot, count);
    near(xyz(layout.cameras.seat(s.x, s.z, slot < 0)), pinned.cameras[k], `camera ${k}`);
  }
  near(xyz(layout.cameras.lookAt), [0, 0.9, 0], "camera target");
});

test("the table and its props haven't moved", () => {
  near([layout.table.y, layout.table.rx, layout.table.rz], [0.8, 1.95, 1.3], "table");
  const a = layout.anchors;
  near([...xyz(a.ticket.position), a.ticket.yaw], [-0.15, 0.803, 0, 0], "ticket");
  near([...xyz(a.pot.position), a.pot.yaw], [0.55, 0.8, 0, 0], "pot");
  near([...xyz(a.squeaky.position), a.squeaky.yaw], [0.3, 0.8, 0.42, -0.8], "squeaky duck");
  near([...xyz(a.statusScreen.position), a.statusScreen.yaw], [-4.62, 1.95, 0.9, Math.PI / 2 + 0.25], "status screen");
  near([...xyz(a.sign.position), a.sign.yaw], [4.95, 2.2, 0, -Math.PI / 2], "sign");
  near([...xyz(a.lamp.position), a.lamp.yaw], [0, 3.2, 0, 0], "lamp");
});
