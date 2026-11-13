// End-to-end safety net: starts the real server and plays a whole session
// through the real client session, store and actions (running in Node, with
// the socket and storage injected), including a restart that restores saved tables.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OpenedTable, TableInfo, type ServerMsg, type TableView } from "../shared/protocol.ts";
import { createActions, type Actions } from "../client/src/app/actions.ts";
import type { GameEvent, ViewChange } from "../client/src/app/events.ts";
import { createSession, type Session } from "../client/src/app/session.ts";
import { createStorage, memoryStorage, type Profile } from "../client/src/app/storage.ts";
import { createStore, type Store } from "../client/src/app/store.ts";

const ROOT = join(import.meta.dirname, "..");
const ENTRY = join(ROOT, JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).main);
const PASSCODE = "letmein";
const WAIT_MS = 5000;

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.once("error", reject);
    s.listen(0, () => {
      const { port } = s.address() as { port: number };
      s.close(() => resolve(port));
    });
  });
}

class Server {
  private proc: ChildProcess | null = null;
  readonly dataDir = mkdtempSync(join(tmpdir(), "pp-e2e-"));
  port = 0;
  get http() {
    return `http://127.0.0.1:${this.port}`;
  }
  get ws() {
    return `ws://127.0.0.1:${this.port}/ws`;
  }

  /** Starts the server; a restart keeps the same port so clients can find it again. */
  async start() {
    this.port ||= await freePort();
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      PORT: String(this.port),
      DATA_DIR: this.dataDir,
      HOST_PASSCODE: PASSCODE,
    };
    for (const k of Object.keys(env)) if (k.startsWith("JIRA_")) delete env[k];
    const proc = spawn(process.execPath, [ENTRY], { env, stdio: ["ignore", "pipe", "pipe"] });
    this.proc = proc;
    let out = "";
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`server didn't start:\n${out}`)), WAIT_MS);
      const onData = (b: Buffer) => {
        out += b;
        if (out.includes("Point Poker on")) {
          clearTimeout(timer);
          resolve();
        }
      };
      proc.stdout.on("data", onData);
      proc.stderr.on("data", (b: Buffer) => (out += b));
      proc.once("exit", (code) => {
        clearTimeout(timer);
        reject(new Error(`server exited (${code}):\n${out}`));
      });
    });
  }

  /** Sends SIGINT, like Fly does on a deploy, and waits for the server to save and exit. */
  async stop() {
    const proc = this.proc;
    if (!proc || proc.exitCode !== null) return;
    this.proc = null;
    await new Promise<void>((resolve) => {
      proc.once("exit", () => resolve());
      proc.kill("SIGINT");
    });
  }

  cleanup() {
    rmSync(this.dataDir, { recursive: true, force: true });
  }
}

/** One player: the real client store, session and actions, plus a tap on the raw socket. */
class Player {
  readonly storage = createStorage(memoryStorage());
  readonly store: Store = createStore();
  readonly session: Session;
  readonly actions: Actions;
  /** What this player saw happen: changes that came with each view, and events. */
  readonly events: (ViewChange | GameEvent)[] = [];
  /** Every message the server sent, straight off the wire. */
  readonly wire: ServerMsg[] = [];
  closeCode = 0;
  private checks = new Set<() => void>();

  readonly room: string;

  private constructor(server: Server, room: string, profile: Profile, extra: { dealerKey?: string; token?: string }) {
    this.room = room;
    this.storage.setProfile(profile);
    if (extra.dealerKey) this.storage.setDealerKey(room, extra.dealerKey);
    if (extra.token) this.storage.setToken(room, extra.token);
    this.session = createSession({
      connect: (url) => {
        const ws = new WebSocket(url);
        ws.addEventListener("message", (e) => this.wire.push(JSON.parse(String(e.data))));
        ws.addEventListener("close", (e) => (this.closeCode = e.code));
        return ws;
      },
      storage: this.storage,
      store: this.store,
      url: server.ws,
      retryDelay: () => 50,
      log: console,
    });
    this.actions = createActions(this.session, this.store);
    this.store.events.on((e) => {
      this.events.push(e);
      this.check();
    });
    this.store.subscribe((s, prev) => {
      if (s.room !== prev.room) this.events.push(...s.changes);
      this.check();
    });
  }

  static async join(
    server: Server,
    room: string,
    profile: Profile,
    extra: { dealerKey?: string; token?: string } = {},
  ) {
    const p = new Player(server, room, profile, extra);
    p.session.join(room);
    await p.until((x) => (!!x.me && !!x.state) || x.closed, "welcome");
    return p;
  }

  get me() {
    return this.store.getState().me!;
  }
  get id() {
    return this.me.id;
  }
  get state() {
    return this.store.getState().room!;
  }
  get isDealer() {
    return !!this.player(this.id)?.isDealer;
  }
  get closed() {
    return this.store.getState().connection.status === "closed";
  }
  get token() {
    return this.storage.token(this.room)!;
  }
  player(id: string) {
    return this.state.players.find((p) => p.id === id);
  }
  toasts() {
    return this.events.flatMap((e) => (e.t === "toast" ? [e.text] : []));
  }

  async leave() {
    this.session.close();
    await this.until((x) => x.closed, "leave");
  }

  private check() {
    for (const c of [...this.checks]) c();
  }

  /** Resolves once `pred` holds, checking again after every change. */
  until(pred: (p: Player) => boolean, label: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const done = () => {
        if (pred(this)) {
          clearTimeout(timer);
          this.checks.delete(done);
          resolve();
        }
      };
      const timer = setTimeout(() => {
        this.checks.delete(done);
        reject(new Error(`timed out waiting for ${label}`));
      }, WAIT_MS);
      this.checks.add(done);
      done();
    });
  }

  untilState(pred: (s: TableView) => boolean, label: string) {
    return this.until((p) => !!p.store.getState().room && pred(p.state), label);
  }
}

const look = (name: string, extra: Partial<Profile["look"]> = {}): Profile => ({
  name,
  look: { color: "#3bceac", body: "bean", cosmetics: ["tophat"], ...extra },
});

test("a whole session over real sockets, including a restart", async (t) => {
  const server = new Server();
  const everyone: Player[] = [];
  const join = async (...args: Parameters<typeof Player.join> extends [Server, ...infer R] ? R : never) => {
    const p = await Player.join(server, ...args);
    everyone.push(p);
    return p;
  };
  t.after(async () => {
    for (const p of everyone) p.session.close();
    await server.stop();
    server.cleanup();
  });
  await server.start();

  // ---- opening a table needs the host passcode
  const denied = await fetch(`${server.http}/api/rooms`, { method: "POST" });
  assert.equal(denied.status, 401);
  const opened = await fetch(`${server.http}/api/rooms`, { method: "POST", headers: { "x-host-passcode": PASSCODE } });
  assert.equal(opened.status, 200);
  const { code, dealerKey } = OpenedTable.parse(await opened.json());
  assert.match(code, /^[A-Z]{4}$/);
  const info = TableInfo.parse(await (await fetch(`${server.http}/api/rooms/${code.toLowerCase()}`)).json());
  assert.deepEqual(info, { exists: true, jiraEnabled: false, needsPasscode: true });
  assert.equal((await fetch(`${server.http}/api/rooms/ZZZZ`)).status, 404);

  // ---- everyone sits down
  const deb = await join(code, look("Deb"), { dealerKey });
  assert.equal(deb.isDealer, true);
  const ann = await join(code, look("Ann"));
  const bob = await join(code, look("Bob", { cosmetics: ["crown"], body: "chonk" }));
  assert.equal(ann.isDealer, false);
  await deb.untilState((s) => s.players.length === 3, "three players");
  assert.equal(deb.player(deb.id)?.seat, -1);
  assert.deepEqual(new Set([ann, bob].map((p) => deb.player(p.id)?.seat)), new Set([0, 1]));
  assert.deepEqual(deb.player(bob.id)?.look, { color: "#3bceac", body: "chonk", cosmetics: ["crown"] });
  await deb.until((p) => p.events.some((e) => e.t === "joined" && e.player.id === bob.id), "joined event");

  // ---- commands get answers: only the dealer runs the round, and failures say why
  await assert.rejects(ann.actions.dealer.reveal(), { message: "Only the dealer can do that" });
  await assert.rejects(deb.actions.dealer.deal(), { message: "Load a ticket first" });
  await assert.rejects(deb.actions.dealer.load("nope"), {
    message: "That doesn't look like a Jira link or key (like SD-1234)",
  });
  await assert.rejects(deb.actions.dealer.load("https://x.atlassian.net/browse/SD-9"), {
    message: "SD-9: Jira isn't configured on the server",
  });

  // ---- a new look is one object
  bob.actions.setLook({ color: "#ffd23f", body: "pear", cosmetics: ["fez"] });
  await ann.until((p) => p.events.some((e) => e.t === "reshaped" && e.player.id === bob.id), "bob reshaped");
  assert.deepEqual(ann.player(bob.id)?.look, { color: "#ffd23f", body: "pear", cosmetics: ["fez"] });

  // ---- a round: vote, change a vote, reveal, settle, re-settle
  await deb.actions.dealer.typeIn("Login page");
  await ann.untilState((s) => s.phase === "voting" && s.round === 1, "voting");
  await bob.untilState((s) => s.phase === "voting", "bob sees voting");
  assert.equal(ann.state.ticket?.key, "TICKET");
  assert.equal(ann.state.ticket?.summary, "Login page");
  assert.ok(ann.events.some((e) => e.t === "dealt"));
  await assert.rejects(deb.actions.dealer.refresh(), { message: "A ticket typed in by hand isn't in Jira" });

  ann.actions.vote(2);
  bob.actions.vote(5);
  await deb.untilState((s) => s.players.filter((p) => p.hasVoted).length === 2, "two votes in");
  await deb.until((p) => p.events.some((e) => e.t === "allIn"), "everyone's in");
  ann.actions.vote(3);
  assert.equal(ann.store.getState().ui.myVote, 3);
  await bob.until((p) => p.events.some((e) => e.t === "fx" && e.fx.kind === "adjust" && e.from === ann.id), "adjust");
  assert.ok(
    !ann.wire.some((m) => m.t === "fx" && m.fx.kind === "adjust"),
    "the voter isn't told about their own adjust",
  );

  await ann.untilState((s) => s.players.find((p) => p.id === ann.id)?.vote === 3, "ann sees her own card");
  // nobody sees anyone else's card before the reveal; you do see your own
  for (const p of [deb, ann, bob]) {
    for (const m of p.wire) {
      if (m.t !== "view") continue;
      assert.ok(
        m.view.players.every((x) => x.vote === null || x.id === p.id) && m.view.pot === 0,
        "vote leaked before reveal",
      );
    }
  }

  await deb.actions.dealer.reveal();
  await bob.untilState((s) => s.phase === "revealed", "revealed");
  assert.equal(bob.player(ann.id)?.vote, 3);
  assert.equal(bob.player(bob.id)?.vote, 5);
  assert.equal(bob.state.pot, 8);
  assert.ok(bob.events.some((e) => e.t === "revealed"));

  await deb.actions.dealer.settle(5);
  await ann.untilState((s) => s.phase === "settled" && s.finalPoints === 5, "settled at 5");
  assert.deepEqual(ann.state.winners, [bob.id]);
  assert.equal(ann.player(bob.id)?.chips, 8);
  assert.equal(ann.state.houseWon, false);

  await deb.actions.dealer.settle(2);
  await ann.untilState((s) => s.finalPoints === 2, "re-settled at 2");
  assert.deepEqual(ann.state.winners, [ann.id]);
  assert.equal(ann.player(ann.id)?.chips, 8);
  assert.equal(ann.player(bob.id)?.chips, 0, "the first payout is taken back");
  assert.equal(ann.state.history.length, 1);
  const [result] = ann.state.history;
  assert.ok(result);
  assert.equal(result.finalPoints, 2);
  assert.deepEqual(
    ann.events.filter((e) => e.t === "settled"),
    [
      { t: "settled", resettled: false },
      { t: "settled", resettled: true },
    ],
  );

  // ---- nobody close enough: the house rakes it in
  await deb.actions.dealer.next();
  await ann.untilState((s) => s.phase === "waiting" && !s.ticket, "back to waiting");
  await deb.session.request({ t: "manualTicket", key: "SD-2", summary: "Search", description: "" });
  await ann.untilState((s) => s.phase === "voting" && s.round === 2, "round 2");
  await bob.untilState((s) => s.round === 2, "bob sees round 2");
  assert.equal(ann.store.getState().ui.myVote, null, "a new round forgets your last card");
  ann.actions.vote(1);
  bob.actions.vote(1);
  await deb.untilState((s) => s.players.filter((p) => p.hasVoted).length === 2, "round 2 votes");
  await deb.actions.dealer.reveal();
  await deb.actions.dealer.settle(8);
  await bob.untilState((s) => s.phase === "settled", "house round settled");
  assert.equal(bob.state.houseWon, true);
  assert.deepEqual(bob.state.winners, [deb.id]);
  assert.equal(bob.player(deb.id)?.chips, 2);

  // ---- reloading mid-vote keeps your card
  await deb.actions.dealer.next();
  await deb.session.request({ t: "manualTicket", key: "SD-3", summary: "Signup", description: "" });
  await ann.untilState((s) => s.round === 3 && s.phase === "voting", "round 3");
  ann.actions.vote(5);
  await deb.untilState((s) => !!s.players.find((p) => p.id === ann.id)?.hasVoted, "ann voted");
  const reloaded = await join(code, look("Ann"), { token: ann.token });
  await ann.until((p) => p.closed, "the old page lets go");
  assert.equal(reloaded.id, ann.id);
  assert.equal(reloaded.store.getState().ui.myVote, 5, "the reloaded page remembers your card");
  assert.equal(bob.player(ann.id)?.vote, null, "and still nobody else sees it");

  // ---- chip flicks have a cooldown the server enforces
  await reloaded.session.request({ t: "flick", target: bob.id });
  await assert.rejects(reloaded.session.request({ t: "flick", target: bob.id }), { message: "Not so fast" });
  await bob.until((p) => p.events.some((e) => e.t === "fx" && e.fx.kind === "flick"), "bob gets bonked");
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(bob.events.filter((e) => e.t === "fx" && e.fx.kind === "flick").length, 1, "only one chip flew");

  // ---- skip and cancel pay nobody
  await deb.actions.dealer.skip();
  await reloaded.untilState((s) => s.phase === "waiting" && s.skipped.includes("SD-3"), "skipped");
  await reloaded.until((p) => p.toasts().includes("⏭️ The dealer skipped SD-3"), "skip toast");
  assert.equal(reloaded.player(ann.id)?.chips, 8);
  assert.equal(reloaded.store.getState().ui.myVote, null);

  await deb.session.request({ t: "manualTicket", key: "SD-4", summary: "Cancel me", description: "" });
  await reloaded.untilState((s) => s.ticket?.key === "SD-4", "round 4");
  await deb.actions.dealer.cancel();
  await reloaded.untilState((s) => s.phase === "waiting" && !s.ticket, "cancelled");
  await bob.until((p) => p.toasts().includes("🎩 The dealer cancelled this round"), "cancel toast");

  // ---- kick: the player is gone and can't come back
  const cat = await join(code, look("Cat"));
  await deb.untilState((s) => s.players.length === 4, "cat sat down");
  await deb.actions.dealer.kick(cat.id);
  await cat.until((p) => p.closed, "cat kicked");
  assert.equal(cat.closeCode, 4001);
  assert.deepEqual(cat.store.getState().connection, { status: "closed", room: code, reason: "Removed by the dealer" });
  await reloaded.untilState((s) => s.players.length === 3, "cat gone");
  await reloaded.until((p) => p.toasts().includes("👋 Cat was removed from the table"), "kick toast");
  await reloaded.until((p) => p.events.some((e) => e.t === "left" && e.player.id === cat.id), "left event");
  const catAgain = await join(code, look("Cat"), { token: cat.token });
  assert.equal(catAgain.closeCode, 4001);

  // ---- reconnect with a seat token
  await reloaded.leave();
  await deb.untilState((s) => s.players.find((p) => p.id === ann.id)?.connected === false, "ann away");
  const ann2 = await join(code, look("Ann"), { token: ann.token });
  assert.equal(ann2.id, ann.id);
  await deb.untilState((s) => s.players.find((p) => p.id === ann.id)?.connected === true, "ann back");
  assert.equal(ann2.player(ann.id)?.chips, 8);
  // the same seat opened in another tab takes over
  const ann3 = await join(code, look("Ann"), { token: ann.token });
  await ann2.until((p) => p.closed, "older tab closed");
  assert.equal(ann2.closeCode, 4002);
  assert.equal(ann3.id, ann.id);

  // ---- restart: saved tables come back and everyone reconnects to their seat on their own
  const before = { deb: deb.id, ann: ann3.id, bob: bob.id };
  await server.stop();
  await Promise.all(
    [deb, bob, ann3].map((p) => p.until((x) => x.store.getState().connection.status === "connecting", "line dropped")),
  );
  await server.start();
  const back = TableInfo.parse(await (await fetch(`${server.http}/api/rooms/${code}`)).json());
  assert.equal(back.exists, true);
  for (const p of [deb, bob, ann3])
    await p.until((x) => x.store.getState().connection.status === "open", "reconnected");
  await deb.untilState((s) => s.players.length === 3 && s.players.every((p) => p.connected), "everyone back");
  assert.deepEqual({ deb: deb.id, ann: ann3.id, bob: bob.id }, before);
  assert.equal(deb.isDealer, true);
  assert.equal(deb.player(ann.id)?.chips, 8);
  assert.equal(deb.player(deb.id)?.chips, 2);
  assert.deepEqual(
    deb.state.history.map((h) => [h.key, h.finalPoints]),
    [
      ["TICKET", 2],
      ["SD-2", 8],
    ],
  );
  assert.deepEqual(deb.state.skipped, ["SD-3"]);
  const catAfter = await join(code, look("Cat"), { token: cat.token });
  assert.equal(catAfter.closeCode, 4001, "bans survive a restart");
});
