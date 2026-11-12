// WebSocket transport: parse → validate → role check (in the Table) → reply.
// One hub per table keeps the sockets; the Table never sees them.
import type { Server } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { FxMsg, JoinMsg, type Command, type ServerMsg } from "../../shared/protocol.ts";
import type { Rooms } from "../rooms.ts";
import { ROLE_ERROR, type Log, type Table, type TableEvent } from "../table/table.ts";

const send = (ws: WebSocket | undefined, msg: ServerMsg) => {
  if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
};

/** Commands whose failures show up in the dealer's ticket picker rather than as a toast. */
const LOADS = new Set<Command["t"]>(["loadTicket", "fetchQueue", "nextRound", "skip"]);

class Hub {
  private readonly sockets = new Map<string, WebSocket>();
  private pushQueued = false;
  readonly table: Table;
  private readonly log: Log;

  constructor(table: Table, log: Log) {
    this.table = table;
    this.log = log;
    table.on((e) => this.onTableEvent(e));
  }

  accept(ws: WebSocket) {
    let me: string | null = null;
    ws.on("message", (raw) => {
      let data: unknown;
      try { data = JSON.parse(String(raw)); } catch { return; }
      const t = (data as { t?: unknown })?.t;
      if (typeof t !== "string") return;
      if (!me) {
        const hello = JoinMsg.safeParse(data);
        if (hello.success) me = this.join(ws, hello.data);
        return;
      }
      const fx = FxMsg.safeParse(data);
      if (fx.success) return this.relay(me, fx.data);
      const playerId = me;
      this.table.run(playerId, data as Command).then((r) => {
        if (!r.error) return;
        if (r.error !== ROLE_ERROR && LOADS.has(t as Command["t"])) send(ws, { t: "loadFailed", text: r.error });
        else send(ws, { t: "toast", text: r.error, level: "error" });
      }, (e) => this.log.error("message failed", t, e));
    });
    ws.on("close", () => {
      if (me && this.sockets.get(me) === ws) {
        this.sockets.delete(me);
        this.table.disconnect(me);
      }
    });
  }

  private join(ws: WebSocket, hello: JoinMsg): string | null {
    const r = this.table.join(hello);
    if (!r.ok) {
      if (r.text) send(ws, { t: "toast", text: r.text, level: "error" });
      ws.close(r.code, r.reason);
      return null;
    }
    const old = this.sockets.get(r.playerId);
    if (old && old !== ws) old.close(4002, "Joined from another tab");
    this.sockets.set(r.playerId, ws);
    send(ws, { t: "welcome", playerId: r.playerId, token: r.token, isDealer: r.isDealer });
    return r.playerId;
  }

  /** Looking around, talking and emotes: relayed, never stored. */
  private relay(from: string, fx: FxMsg) {
    switch (fx.t) {
      case "look": return this.broadcast({ t: "look", id: from, yaw: fx.yaw, pitch: fx.pitch }, from);
      case "talk": {
        const level = Math.round(Math.min(1, Math.max(0, fx.level)) * 100) / 100;
        return this.broadcast({ t: "talk", id: from, level }, from);
      }
      case "emote": return this.broadcast({ t: "emote", id: from, kind: fx.kind });
    }
  }

  private onTableEvent(e: TableEvent) {
    switch (e.t) {
      case "changed":
        // several changes in one tick go out as one update
        if (!this.pushQueued) { this.pushQueued = true; queueMicrotask(() => this.push()); }
        return;
      case "notice": return this.broadcast({ t: "toast", text: e.text, level: e.level }, e.except);
      case "fx":
        if (e.fx.kind === "adjust") return this.broadcast({ t: "adjust", id: e.fx.id }, e.except);
        return this.broadcast({ t: "flick", from: e.fx.from, to: e.fx.to }, e.except);
      case "removed": {
        const ws = this.sockets.get(e.playerId);
        this.sockets.delete(e.playerId);
        ws?.close(4001, e.reason);
      }
    }
  }

  private push() {
    this.pushQueued = false;
    for (const [id, ws] of this.sockets) send(ws, { t: "state", state: this.table.viewFor(id) });
  }

  private broadcast(msg: ServerMsg, except?: string) {
    const data = JSON.stringify(msg);
    for (const [id, ws] of this.sockets) if (id !== except && ws.readyState === ws.OPEN) ws.send(data);
  }
}

export function attachSockets(server: Server, rooms: Rooms, log: Log) {
  const hubs = new WeakMap<Table, Hub>();
  const wss = new WebSocketServer({ server, path: "/ws", maxPayload: 32 * 1024 });
  wss.on("connection", (ws, req) => {
    const code = new URL(req.url ?? "", "http://x").searchParams.get("room") ?? "";
    const table = rooms.get(code);
    if (!table) return ws.close(4004, "No such room");
    let hub = hubs.get(table);
    if (!hub) hubs.set(table, (hub = new Hub(table, log)));
    hub.accept(ws);
  });
  return wss;
}
