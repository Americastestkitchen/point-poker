// The app, assembled from the adapters it's given. No globals, no env.
import { createServer } from "node:http";
import type { DealerAuth } from "./auth/passcode.ts";
import { Rooms } from "./rooms.ts";
import type { RoomStore } from "./store/store.ts";
import type { TableDeps } from "./table/table.ts";
import { httpHandler } from "./transport/http.ts";
import { attachSockets } from "./transport/ws.ts";

export interface AppDeps extends TableDeps {
  store: RoomStore;
  auth: DealerAuth;
  /** The built client (dist/). */
  distDir: string;
}

/** Tables nobody has touched for this long, with nobody connected, are forgotten. */
export const IDLE_MS = 6 * 3600_000;

export function createApp(deps: AppDeps) {
  const { store, auth, distDir, ...tableDeps } = deps;
  const rooms = new Rooms(tableDeps, store.load());
  const handle = httpHandler({ rooms, auth, distDir });
  // A request that throws (like a path that won't decode) gets a 500, not a crashed server.
  const server = createServer((req, res) => {
    handle(req, res).catch((e: unknown) => {
      deps.log.error("request failed", req.url, e);
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
  });
  attachSockets(server, rooms, { log: deps.log, now: deps.now });
  return {
    server,
    rooms,
    save: () => store.save(rooms.snapshot()),
    sweep: () => rooms.sweep(IDLE_MS),
  };
}
