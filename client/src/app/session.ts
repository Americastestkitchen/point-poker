// The connection to a table: joins with your seat token, reconnects when the
// line drops, sends commands and matches up their replies, and feeds what the
// server says into the store. The socket and storage are injected, so it runs
// in Node tests as well as the browser.
import type { Command } from "../../../server/table/commands.ts";
import { DEFAULT_LOOK } from "../../../shared/look.ts";
import { ServerMsg, type ClientFx, type ClientMsg } from "../../../shared/protocol.ts";
import type { Storage } from "./storage.ts";
import type { AppState, Store } from "./store.ts";

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
/** 4001 kicked, 4002 opened elsewhere, 4003 table full, 4004 no such table: don't fight it. */
const FINAL = (code: number) => code >= 4001 && code <= 4004;

export function createSession(deps: SessionDeps): Session {
  const { storage, store } = deps;
  const retryDelay = deps.retryDelay ?? ((n) => Math.min(5000, 500 * 2 ** n));
  let ws: SocketLike | null = null;
  let room = "";
  let attempt = 0;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let nextId = 1;
  const pending = new Map<number, { resolve(): void; reject(e: Error): void }>();

  const status = (connection: AppState["connection"]) => store.setState({ connection });
  const live = () => ws?.readyState === OPEN && !stopped;
  const send = (msg: ClientMsg) => ws!.send(JSON.stringify(msg));

  function hello(): ClientMsg {
    const p = storage.profile();
    return { t: "join", name: p.name ?? "", look: p.look ?? DEFAULT_LOOK, token: storage.token(room), dealerKey: storage.dealerKey(room) };
  }

  function receive(m: ServerMsg) {
    switch (m.t) {
      case "welcome":
        storage.setToken(room, m.token);
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

  function connect() {
    status({ room, status: "connecting" });
    const sock = deps.connect(`${deps.url}?room=${encodeURIComponent(room)}`);
    ws = sock;
    sock.onopen = () => {
      attempt = 0;
      status({ room, status: "open" });
      sock.send(JSON.stringify(hello()));
    };
    sock.onmessage = (e: { data: unknown }) => {
      let parsed;
      try { parsed = ServerMsg.safeParse(JSON.parse(String(e.data))); } catch { return; }
      if (parsed.success) receive(parsed.data);
      else console.warn("ignoring a message we don't understand", parsed.error);
    };
    sock.onclose = (e: { code: number; reason: string }) => {
      if (ws !== sock) return;
      ws = null;
      // anything still waiting for an answer won't get one now
      for (const p of pending.values()) p.reject(new Error("Lost the connection. Try again?"));
      pending.clear();
      if (stopped || FINAL(e.code)) {
        stopped = true;
        status({ room, status: "closed", reason: e.reason });
        return;
      }
      status({ room, status: "connecting" });
      timer = setTimeout(connect, retryDelay(attempt++));
    };
  }

  return {
    join(code) {
      room = code;
      stopped = false;
      connect();
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
      stopped = true;
      clearTimeout(timer);
      ws?.close();
    },
  };
}
