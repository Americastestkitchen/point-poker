// The connection to a table: joins with your seat token, reconnects when the
// line drops, sends commands and matches up their replies, and feeds what the
// server says into the store. The socket and storage are injected, so it runs
// in Node tests as well as the browser.
import type { Command } from "../../../server/table/commands.ts";
import { DEFAULT_LOOK } from "../../../shared/look.ts";
import { ServerMsg, type ClientFx, type ClientMsg } from "../../../shared/protocol.ts";
import { nextConnection, type ConnectionEffect, type ConnectionEvent } from "./connection.ts";
import type { Storage } from "./storage.ts";
import type { Store } from "./store.ts";

/**
 * The bits of a WebSocket the session uses. The browser's WebSocket and
 * Node's global one both fit (handler params are loose so either's event types do).
 */
export interface SocketLike {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: ((e: any) => void) | null;
  onmessage: ((e: any) => void) | null;
  onclose: ((e: any) => void) | null;
}

export interface SessionDeps {
  connect(url: string): SocketLike;
  storage: Storage;
  store: Store;
  /** The WebSocket endpoint, like wss://host/ws. */
  url: string;
  /** Wait before reconnect attempt n (from 0). */
  retryDelay?(attempt: number): number;
}

export interface Session {
  join(room: string): void;
  /** Sends a command; resolves when the server says it worked, rejects with its reason if not. */
  request(cmd: Command): Promise<void>;
  /** Sends an effect (looking around, talking, emotes). No reply. */
  fx(fx: ClientFx): void;
  close(): void;
}

const OPEN = 1;

export function createSession(deps: SessionDeps): Session {
  const { storage, store } = deps;
  const retryDelay = deps.retryDelay ?? ((n) => Math.min(5000, 500 * 2 ** n));
  // the line itself; whether we should have one is the store's `connection`
  let ws: SocketLike | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let nextId = 1;
  const pending = new Map<number, { resolve(): void; reject(e: Error): void }>();

  const connection = () => store.getState().connection;
  const room = () => { const c = connection(); return c.status === "idle" ? "" : c.room; };
  const live = () => ws?.readyState === OPEN && connection().status === "open";
  const send = (msg: ClientMsg) => ws!.send(JSON.stringify(msg));

  /** Moves the connection on, then does what that step says. */
  function step(e: ConnectionEvent) {
    const [next, effect] = nextConnection(connection(), e, retryDelay);
    if (next !== connection()) store.setState({ connection: next });
    if (effect) run(effect);
  }

  function run(effect: ConnectionEffect) {
    switch (effect.t) {
      case "dial": return dial();
      case "redial": timer = setTimeout(dial, effect.afterMs); return;
      case "hello": return send(hello());
      case "hangUp": {
        clearTimeout(timer);
        const sock = ws;
        ws = null;
        failPending();
        sock?.close();
        return;
      }
      default: return effect satisfies never;
    }
  }

  /** Anything still waiting for an answer won't get one now. */
  function failPending() {
    for (const p of pending.values()) p.reject(new Error("Lost the connection. Try again?"));
    pending.clear();
  }

  function hello(): ClientMsg {
    const p = storage.profile();
    return { t: "join", name: p.name ?? "", look: p.look ?? DEFAULT_LOOK, token: storage.token(room()), dealerKey: storage.dealerKey(room()) };
  }

  function receive(m: ServerMsg) {
    switch (m.t) {
      case "welcome":
        storage.setToken(room(), m.token);
        store.setState({ me: { id: m.playerId } });
        return;
      case "view":
        return store.receive(m.view);
      case "result": {
        const p = pending.get(m.id);
        pending.delete(m.id);
        if (m.error) p?.reject(new Error(m.error));
        else p?.resolve();
        return;
      }
      case "toast":
      case "fx":
        return store.events.emit(m);
      default:
        // a new server message stops compiling here until it's handled
        return m satisfies never;
    }
  }

  function dial() {
    const sock = deps.connect(`${deps.url}?room=${encodeURIComponent(room())}`);
    ws = sock;
    sock.onopen = () => { if (ws === sock) step({ t: "opened" }); };
    sock.onmessage = (e: { data: unknown }) => {
      let parsed;
      try { parsed = ServerMsg.safeParse(JSON.parse(String(e.data))); } catch { return; }
      if (parsed.success) receive(parsed.data);
      else console.warn("ignoring a message we don't understand", parsed.error);
    };
    sock.onclose = (e: { code: number; reason: string }) => {
      if (ws !== sock) return;
      ws = null;
      failPending();
      step({ t: "dropped", code: e.code, reason: e.reason });
    };
  }

  return {
    join(code) {
      step({ t: "join", room: code });
    },
    request(cmd) {
      if (!live()) return Promise.reject(new Error("Not connected right now. Try again in a moment."));
      const id = nextId++;
      const reply = new Promise<void>((resolve, reject) => pending.set(id, { resolve, reject }));
      send({ t: "cmd", id, cmd });
      return reply;
    },
    fx(fx) {
      if (live()) send({ t: "fx", fx });
    },
    close() {
      step({ t: "leave" });
    },
  };
}
