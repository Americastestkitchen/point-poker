// Pins where everything on and around the table sits today, for every table
// size, so nothing moves by accident. The positions live in
// layout.test.ts.snapshot; `npm run test:update-snapshots` rewrites it.
import { test } from "node:test";
import { MAX_PLAYERS } from "../../../../shared/rules.ts";
import { pin } from "../../../../test/pin.ts";
import { layout, type Anchor, type Vec3 } from "./layout.ts";

const xyz = (v: Vec3) => [v.x, v.y, v.z];
const spot = (a: Anchor) => [...xyz(a.position), a.yaw];

test("seats, cards, chip stacks and cameras stay put, for every table size", async (t) => {
  for (let count = 1; count <= MAX_PLAYERS; count++) {
    await t.test(`${count} players`, (t) => {
      const seats: Record<string, unknown> = {};
      for (let slot = -1; slot < count; slot++) {
        const s = layout.seat(slot, count);
        seats[slot < 0 ? "dealer" : `slot ${slot}`] = {
          seat: [s.x, s.z, s.facing],
          card: spot(layout.card(slot, count, false)),
          myCard: xyz(layout.card(slot, count, true).position),
          stack: xyz(layout.stack(slot, count)),
          camera: xyz(layout.cameras.seat(s.x, s.z, slot < 0)),
        };
      }
      pin(t, seats);
    });
  }
});

test("the table, its props and the camera target stay put", (t) => {
  const { table, anchors, cameras } = layout;
  pin(t, {
    table: [table.y, table.rx, table.rz],
    ...Object.fromEntries(Object.entries(anchors).map(([name, a]) => [name, spot(a)])),
    cameraTarget: xyz(cameras.lookAt),
    titleCamera: [
      cameras.title.radius,
      cameras.title.height,
      cameras.title.angle,
      cameras.title.sway,
      cameras.title.swaySpeed,
      cameras.title.bob,
      cameras.title.bobSpeed,
    ],
    titleTarget: xyz(cameras.title.lookAt),
  });
});
