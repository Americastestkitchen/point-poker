// The connection to a table: joins with your seat token, reconnects when the
// line drops, and feeds what the server says into the store. The socket and
// storage are injected, so it runs in Node tests as well as the browser.
import { ServerMsg, type ClientMsg } from "../../../shared/protocol.ts";
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
  send(msg: ClientMsg): void;
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

  const status = (connection: AppState["connection"]) => store.setState({ connection });

  function hello(): ClientMsg {
    const p = storage.profile();
    return {
      t: "join", name: p.name ?? "", color: p.color ?? "", hat: p.hat ?? "none", body: p.body,
      token: storage.token(room), dealerKey: storage.dealerKey(room),
    };
  }

  function receive(m: ServerMsg) {
    switch (m.t) {
      case "welcome":
        storage.setToken(room, m.token);
        store.setState({ me: { id: m.playerId, isDealer: m.isDealer } });
        return;
      case "state":
        return store.receive(m.state);
      default:
        return store.events.emit(m);
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
    send(msg) {
      if (ws?.readyState === OPEN && !stopped) ws.send(JSON.stringify(msg));
    },
    close() {
      stopped = true;
      clearTimeout(timer);
      ws?.close();
    },
  };
}
