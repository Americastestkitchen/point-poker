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
  storage.setProfile({ name: "Ann", look: { color: "#3bceac", body: "pear", cosmetics: ["fez"] } });
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
  assert.deepEqual(sockets[0].sent, [{ t: "join", name: "Ann", look: { color: "#3bceac", body: "pear", cosmetics: ["fez"] }, token: "old-token" }]);
  sockets[0].receive({ t: "welcome", playerId: "ann", token: "new-token" });
  sockets[0].receive({ t: "view", view: view() });
  assert.equal(storage.token("ABCD"), "new-token");
  assert.deepEqual(store.getState().me, { id: "ann" });
  assert.equal(store.getState().room?.code, "ABCD");
});

test("server effects go on the event stream; nonsense is ignored", () => {
  const { sockets, store, session } = setup();
  const seen: unknown[] = [];
  store.events.on((e) => seen.push(e));
  session.join("ABCD");
  sockets[0].open();
  sockets[0].receive({ t: "fx", from: "bob", fx: { kind: "emote", emote: "wave" } });
  sockets[0].receive({ t: "fx", from: "bob", fx: { kind: "emote", emote: "moonwalk" } });
  sockets[0].receive({ t: "fx", from: "bob", fx: { kind: "flick", to: "ann" } });
  sockets[0].receive({ t: "fx", from: "bob", fx: { kind: "adjust" } });
  sockets[0].receive({ t: "toast", text: "hi" });
  assert.deepEqual(seen, [
    { t: "emote", id: "bob", emote: "wave" },
    { t: "flick", from: "bob", to: "ann" },
    { t: "adjust", id: "bob" },
    { t: "toast", text: "hi" },
  ]);
});

test("commands get an id and settle when their result comes back", async () => {
  const { sockets, session } = setup();
  await assert.rejects(session.request({ t: "reveal" }), /Not connected/);
  session.join("ABCD");
  sockets[0].open();
  const ok = session.request({ t: "reveal" });
  const bad = session.request({ t: "loadTicket", ref: "SD-1" });
  const lost = session.request({ t: "deal" });
  assert.deepEqual(sockets[0].sent.slice(1), [
    { t: "cmd", id: 1, cmd: { t: "reveal" } },
    { t: "cmd", id: 2, cmd: { t: "loadTicket", ref: "SD-1" } },
    { t: "cmd", id: 3, cmd: { t: "deal" } },
  ]);
  sockets[0].receive({ t: "result", id: 2, error: "SD-1: Jira answered 500" });
  sockets[0].receive({ t: "result", id: 1 });
  await ok;
  await assert.rejects(bad, { message: "SD-1: Jira answered 500" });
  sockets[0].drop();
  await assert.rejects(lost, /Lost the connection/);
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
  session.fx({ kind: "emote", emote: "wave" });
  await assert.rejects(session.request({ t: "reveal" }));
  assert.equal(sockets[1].sent.length, 1, "nothing goes out once closed for good");
});
