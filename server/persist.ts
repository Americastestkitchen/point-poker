// Saves rooms to disk so a deploy or restart doesn't wipe open tables.
// Only active when DATA_DIR is set (production mounts a Fly volume there).
// Players reconnect on their own afterwards: their browser keeps a token for their seat.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DATA_DIR = process.env.DATA_DIR ?? "";
const FILE = DATA_DIR ? join(DATA_DIR, "rooms.json") : "";

export const persistEnabled = !!FILE;

/** Things that can't go in JSON: sockets are dropped, Maps and Sets become arrays. */
function toJSON(rooms: Map<string, any>) {
  return [...rooms.values()].map((r) => ({
    ...r,
    players: [...r.players.values()].map((p: any) => ({ ...p, socket: null })),
    skipped: [...r.skipped],
    banned: [...r.banned],
  }));
}

export function saveRooms(rooms: Map<string, any>) {
  if (!FILE) return;
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    // write then rename, so a crash mid-write never leaves a half-written file
    writeFileSync(FILE + ".tmp", JSON.stringify(toJSON(rooms)));
    renameSync(FILE + ".tmp", FILE);
  } catch (e) {
    console.error("could not save rooms", e);
  }
}

export function loadRooms(): Map<string, any> {
  const rooms = new Map<string, any>();
  if (!FILE) return rooms;
  try {
    for (const r of JSON.parse(readFileSync(FILE, "utf8"))) {
      rooms.set(r.code, {
        ...r,
        players: new Map(r.players.map((p: any) => [p.id, { ...p, socket: null }])),
        skipped: new Set(r.skipped ?? []),
        banned: new Set(r.banned ?? []),
        houseWon: r.houseWon ?? false,
      });
    }
  } catch (e: any) {
    if (e?.code !== "ENOENT") console.error("could not load saved rooms", e);
  }
  return rooms;
}
