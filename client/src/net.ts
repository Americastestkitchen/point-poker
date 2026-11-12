// WebSocket connection with automatic reconnect.
import type { ClientMsg, ServerMsg } from "../../shared/protocol.ts";

export class Net {
  private ws: WebSocket | null = null;
  private retry = 0;
  private closedForGood = false;
  onMessage: (m: ServerMsg) => void = () => {};
  onStatus: (s: "connecting" | "open" | "closed", reason?: string) => void = () => {};
  private readonly room: string;
  private readonly hello: () => ClientMsg;

  constructor(room: string, hello: () => ClientMsg) {
    this.room = room;
    this.hello = hello;
  }

  connect() {
    this.onStatus("connecting");
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${location.host}/ws?room=${encodeURIComponent(this.room)}`);
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.onStatus("open");
      ws.send(JSON.stringify(this.hello()));
    };
    ws.onmessage = (e) => this.onMessage(JSON.parse(e.data));
    ws.onclose = (e) => {
      if (this.ws !== ws) return;
      // 4002 = opened elsewhere, 4001 = kicked, 4003 = full, 4004 = no room: don't fight it
      if (e.code >= 4001 && e.code <= 4004) {
        this.closedForGood = true;
        this.onStatus("closed", e.reason);
        return;
      }
      this.onStatus("connecting");
      setTimeout(() => this.connect(), Math.min(5000, 500 * 2 ** this.retry++));
    };
  }

  send(m: ClientMsg) {
    if (this.ws?.readyState === WebSocket.OPEN && !this.closedForGood) this.ws.send(JSON.stringify(m));
  }
}
