// WebSocket transport: parse → validate → role check (in the Table) → reply.
// One hub per table keeps the sockets; the Table never sees them.
import type { Server } from "node:http";
import { WebSocketServer, type RawData, type WebSocket } from "ws";
import { ClientMsg, type ClientFx, type ServerMsg } from "../../shared/protocol.ts";
import type { Rooms } from "../rooms.ts";
import type { Log, Table, TableEvent } from "../table/table.ts";

const send = (ws: WebSocket | undefined, msg: ServerMsg) => {
  if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
};

/** How many of each effect a player may send: a burst, then a steady rate per second. */
const FX_LIMITS: Record<ClientFx["kind"], { burst: number; perSecond: number }> = {
  gaze: { burst: 20, perSecond: 20 },
  talk: { burst: 20, perSecond: 20 },
  emote: { burst: 3, perSecond: 2 },
};

/** A token bucket per player and effect: relays never outpace what a person can do. */
function rateLimiter(now: () => number) {
  const buckets = new Map<string, { tokens: number; at: number }>();
  return (playerId: string, kind: ClientFx["kind"]) => {
    const { burst, perSecond } = FX_LIMITS[kind];
    const key = `${playerId}:${kind}`,
      t = now();
    const b = buckets.get(key) ?? { tokens: burst, at: t };
    b.tokens = Math.min(burst, b.tokens + ((t - b.at) / 1000) * perSecond);
    b.at = t;
    buckets.set(key, b);
    if (b.tokens < 1) return false;
    b.tokens -= 1;
    return true;
  };
}

/** A message's text, whichever buffer shape `ws` handed over. */
function rawText(raw: RawData): string {
  if (Array.isArray(raw)) return Buffer.concat(raw).toString();
  if (raw instanceof ArrayBuffer) return Buffer.from(raw).toString();
  return raw.toString();
}

class Hub {
  private readonly sockets = new Map<string, WebSocket>();
  private pushQueued = false;
  private readonly table: Table;
  private readonly log: Log;
  private readonly allow: ReturnType<typeof rateLimiter>;

  constructor(table: Table, deps: { log: Log; now(): number }) {
    this.table = table;
    this.log = deps.log;
    this.allow = rateLimiter(deps.now);
    table.on((e) => this.onTableEvent(e));
  }

  accept(ws: WebSocket) {
    let me: string | null = null;
    ws.on("message", (raw) => {
      let data: unknown;
      try {
        data = JSON.parse(rawText(raw));
      } catch {
        return;
      }
      const parsed = ClientMsg.safeParse(data);
      if (!parsed.success) return;
      const msg = parsed.data;
      if (!me) {
        if (msg.t === "join") me = this.join(ws, msg);
        return;
      }
      if (msg.t === "fx") return this.relay(me, msg.fx);
      if (msg.t !== "cmd") return;
      this.table.run(me, msg.cmd).then(
        (r) => send(ws, { t: "result", id: msg.id, ...(r.error ? { error: r.error } : {}) }),
        (e: unknown) => this.log.error("command failed", msg.cmd.t, e),
      );
    });
    ws.on("close", () => {
      if (me && this.sockets.get(me) === ws) {
        this.sockets.delete(me);
        this.table.disconnect(me);
      }
    });
  }

  private join(ws: WebSocket, hello: Extract<ClientMsg, { t: "join" }>): string | null {
    const r = this.table.join(hello);
    if (!r.ok) {
      if (r.text) send(ws, { t: "toast", text: r.text, level: "error" });
      ws.close(r.code, r.reason);
      return null;
    }
    const old = this.sockets.get(r.playerId);
    if (old && old !== ws) old.close(4002, "Joined from another tab");
    this.sockets.set(r.playerId, ws);
    send(ws, { t: "welcome", playerId: r.playerId, token: r.token });
    return r.playerId;
  }

  /** Looking around, talking and emotes: rate-limited, relayed, never stored. */
  private relay(from: string, fx: ClientFx) {
    if (!this.allow(from, fx.kind)) return;
    if (fx.kind === "talk") fx = { kind: "talk", level: Math.round(Math.min(1, Math.max(0, fx.level)) * 100) / 100 };
    // you see your own emote; your own gaze and voice you already know
    this.broadcast({ t: "fx", from, fx }, fx.kind === "emote" ? undefined : from);
  }

  private onTableEvent(e: TableEvent) {
    switch (e.t) {
      case "changed":
        // several changes in one tick go out as one update
        if (!this.pushQueued) {
          this.pushQueued = true;
          queueMicrotask(() => this.push());
        }
        return;
      case "notice": {
        const toast: ServerMsg = { t: "toast", text: e.text, level: e.level };
        if (e.to === undefined) return this.broadcast(toast, e.except);
        return send(this.sockets.get(e.to), toast);
      }
      case "fx":
        return this.broadcast({ t: "fx", from: e.from, fx: e.fx }, e.except);
      case "removed": {
        const ws = this.sockets.get(e.playerId);
        this.sockets.delete(e.playerId);
        ws?.close(4001, e.reason);
      }
    }
  }

  /** Everyone gets their own view: the same table, but only their own card before the reveal. */
  private push() {
    this.pushQueued = false;
    for (const [id, ws] of this.sockets) send(ws, { t: "view", view: this.table.viewFor(id) });
  }

  private broadcast(msg: ServerMsg, except?: string) {
    const data = JSON.stringify(msg);
    for (const [id, ws] of this.sockets) if (id !== except && ws.readyState === ws.OPEN) ws.send(data);
  }
}

export function attachSockets(server: Server, rooms: Rooms, deps: { log: Log; now(): number }) {
  const hubs = new WeakMap<Table, Hub>();
  const wss = new WebSocketServer({ server, path: "/ws", maxPayload: 32 * 1024 });
  wss.on("connection", (ws, req) => {
    const code = new URL(req.url ?? "", "http://x").searchParams.get("room") ?? "";
    const table = rooms.get(code);
    if (!table) return ws.close(4004, "No such room");
    let hub = hubs.get(table);
    if (!hub) hubs.set(table, (hub = new Hub(table, deps)));
    hub.accept(ws);
  });
  return wss;
}
