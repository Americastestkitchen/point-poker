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
  constructor(url: string) {
    this.url = url;
  }
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close() {}
  open() {
    this.readyState = 1;
    this.onopen?.({});
  }
  receive(m: unknown) {
    this.onmessage?.({ data: JSON.stringify(m) });
  }
  drop(code = 1006, reason = "") {
    this.readyState = 3;
    this.onclose?.({ code, reason });
  }
}

function setup() {
  const sockets: FakeSocket[] = [];
  const storage = createStorage(memoryStorage());
  storage.setProfile({ name: "Ann", look: { color: "#3bceac", body: "pear", cosmetics: ["fez"] } });
  const store = createStore();
  const warnings: unknown[][] = [];
  const session = createSession({
    connect: (url) => {
      const s = new FakeSocket(url);
      sockets.push(s);
      return s;
    },
    storage,
    store,
    url: "ws://x/ws",
    retryDelay: () => 0,
    log: { warn: (...args) => warnings.push(args) },
  });
  return { sockets, storage, store, session, warnings };
}

test("joins with your profile and seat token, and keeps the new token", () => {
  const { sockets, storage, store, session } = setup();
  storage.setToken("ABCD", "old-token");
  session.join("ABCD");
  const [socket] = sockets;
  assert.ok(socket);
  assert.equal(socket.url, "ws://x/ws?room=ABCD");
  assert.equal(store.getState().connection.status, "connecting");
  socket.open();
  assert.deepEqual(socket.sent, [
    { t: "join", name: "Ann", look: { color: "#3bceac", body: "pear", cosmetics: ["fez"] }, token: "old-token" },
  ]);
  socket.receive({ t: "welcome", playerId: "ann", token: "new-token" });
  socket.receive({ t: "view", view: view() });
  assert.equal(storage.token("ABCD"), "new-token");
  assert.deepEqual(store.getState().me, { id: "ann" });
  assert.equal(store.getState().room?.code, "ABCD");
});

test("server effects go on the event stream; nonsense is ignored", () => {
  const { sockets, store, session, warnings } = setup();
  const seen: unknown[] = [];
  store.events.on((e) => seen.push(e));
  session.join("ABCD");
  const [socket] = sockets;
  assert.ok(socket);
  socket.open();
  socket.receive({ t: "fx", from: "bob", fx: { kind: "emote", emote: "wave" } });
  socket.receive({ t: "fx", from: "bob", fx: { kind: "emote", emote: "party", to: "ann" } });
  socket.receive({ t: "fx", from: "bob", fx: { kind: "emote", emote: "moonwalk" } });
  socket.receive({ t: "fx", from: "bob", fx: { kind: "flick", to: "ann" } });
  socket.receive({ t: "fx", from: "bob", fx: { kind: "adjust" } });
  socket.receive({ t: "toast", text: "hi" });
  assert.deepEqual(seen, [
    { t: "fx", from: "bob", fx: { kind: "emote", emote: "wave" } },
    { t: "fx", from: "bob", fx: { kind: "emote", emote: "party", to: "ann" } },
    { t: "fx", from: "bob", fx: { kind: "flick", to: "ann" } },
    { t: "fx", from: "bob", fx: { kind: "adjust" } },
    { t: "toast", text: "hi" },
  ]);
  assert.equal(warnings.length, 1, "the unknown emote is noted");
});

test("commands get an id and settle when their result comes back", async () => {
  const { sockets, session } = setup();
  await assert.rejects(session.request({ t: "reveal" }), /Not connected/);
  session.join("ABCD");
  const [socket] = sockets;
  assert.ok(socket);
  socket.open();
  const ok = session.request({ t: "reveal" });
  const bad = session.request({ t: "loadTicket", ref: "SD-1" });
  const lost = session.request({ t: "deal" });
  assert.deepEqual(socket.sent.slice(1), [
    { t: "cmd", id: 1, cmd: { t: "reveal" } },
    { t: "cmd", id: 2, cmd: { t: "loadTicket", ref: "SD-1" } },
    { t: "cmd", id: 3, cmd: { t: "deal" } },
  ]);
  socket.receive({ t: "result", id: 2, error: "SD-1: Jira answered 500" });
  socket.receive({ t: "result", id: 1 });
  await ok;
  await assert.rejects(bad, { message: "SD-1: Jira answered 500" });
  socket.drop();
  await assert.rejects(lost, /Lost the connection/);
});

test("reconnects after a dropped line, but not after being kicked", async () => {
  const { sockets, store, session } = setup();
  session.join("ABCD");
  const [socket] = sockets;
  assert.ok(socket);
  socket.open();
  socket.drop();
  assert.equal(store.getState().connection.status, "connecting");
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(sockets.length, 2);
  const reconnected = sockets[1];
  assert.ok(reconnected);
  reconnected.open();
  reconnected.drop(4001, "Removed by the dealer");
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(sockets.length, 2);
  assert.deepEqual(store.getState().connection, { room: "ABCD", status: "closed", reason: "Removed by the dealer" });
  session.fx({ kind: "emote", emote: "wave" });
  await assert.rejects(session.request({ t: "reveal" }));
  assert.equal(reconnected.sent.length, 1, "nothing goes out once closed for good");
});

test("leaving while waiting to redial stops for good", async () => {
  const { sockets, store, session } = setup();
  session.join("ABCD");
  const [socket] = sockets;
  assert.ok(socket);
  socket.open();
  socket.drop();
  session.close();
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(sockets.length, 1, "no redial after leaving");
  assert.equal(store.getState().connection.status, "closed");
});
