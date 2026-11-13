import { test } from "node:test";
import assert from "node:assert/strict";
import { createSession, type SocketLike } from "./session.ts";
import { createStorage, memoryStorage } from "./storage.ts";
import { createStore } from "./store.ts";
import { view } from "./fixtures.ts";

class FakeSocket implements SocketLike {
  readyState = 0;
  sent: unknown[] = [];
  onopen: ((e: unknown) => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onclose: ((e: { code: number; reason: string }) => void) | null = null;
  readonly url: string;
  constructor(url: string) { this.url = url; }
  send(data: string) { this.sent.push(JSON.parse(data)); }
  close() {}
  open() { this.readyState = 1; this.onopen?.({}); }
  receive(m: unknown) { this.onmessage?.({ data: JSON.stringify(m) }); }
  drop(code = 1006, reason = "") { this.readyState = 3; this.onclose?.({ code, reason }); }
}

function setup() {
  const sockets: FakeSocket[] = [];
  const storage = createStorage(memoryStorage());
  storage.setProfile({ name: "Ann", color: "#3bceac", hat: "fez", body: "pear" });
  const store = createStore();
  const session = createSession({
    connect: (url) => { const s = new FakeSocket(url); sockets.push(s); return s; },
    storage, store, url: "ws://x/ws", retryDelay: () => 0,
  });
  return { sockets, storage, store, session };
}

test("joins with your profile and seat token, and keeps the new token", () => {
  const { sockets, storage, store, session } = setup();
  storage.setToken("ABCD", "old-token");
  session.join("ABCD");
  assert.equal(sockets[0].url, "ws://x/ws?room=ABCD");
  assert.equal(store.getState().connection.status, "connecting");
  sockets[0].open();
  assert.deepEqual(sockets[0].sent, [{ t: "join", name: "Ann", color: "#3bceac", hat: "fez", body: "pear", token: "old-token" }]);
  sockets[0].receive({ t: "welcome", playerId: "ann", token: "new-token", isDealer: false });
  sockets[0].receive({ t: "state", state: view() });
  assert.equal(storage.token("ABCD"), "new-token");
  assert.deepEqual(store.getState().me, { id: "ann", isDealer: false });
  assert.equal(store.getState().room?.code, "ABCD");
});

test("server effects go on the event stream; nonsense is ignored", () => {
  const { sockets, store, session } = setup();
  const seen: string[] = [];
  store.events.on((e) => seen.push(e.t));
  session.join("ABCD");
  sockets[0].open();
  sockets[0].receive({ t: "emote", id: "bob", kind: "wave" });
  sockets[0].receive({ t: "emote", id: "bob", kind: "moonwalk" });
  sockets[0].receive({ t: "toast", text: "hi" });
  assert.deepEqual(seen, ["emote", "toast"]);
});

test("reconnects after a dropped line, but not after being kicked", async () => {
  const { sockets, store, session } = setup();
  session.join("ABCD");
  sockets[0].open();
  sockets[0].drop();
  assert.equal(store.getState().connection.status, "connecting");
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(sockets.length, 2);
  sockets[1].open();
  sockets[1].drop(4001, "Removed by the dealer");
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(sockets.length, 2);
  assert.deepEqual(store.getState().connection, { room: "ABCD", status: "closed", reason: "Removed by the dealer" });
  session.send({ t: "reveal" });
  assert.equal(sockets[1].sent.length, 1, "nothing goes out once closed for good");
});
