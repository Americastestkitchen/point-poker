// End-to-end safety net: starts the real server and plays a whole session with
// scripted WebSocket clients, including a restart that restores saved tables.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ClientMsg, RoomState, ServerMsg } from "../shared/protocol.ts";

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
  get http() { return `http://127.0.0.1:${this.port}`; }
  get ws() { return `ws://127.0.0.1:${this.port}/ws`; }

  async start() {
    this.port = await freePort();
    const env: NodeJS.ProcessEnv = { ...process.env, PORT: String(this.port), DATA_DIR: this.dataDir, HOST_PASSCODE: PASSCODE };
    for (const k of Object.keys(env)) if (k.startsWith("JIRA_")) delete env[k];
    const proc = spawn(process.execPath, [ENTRY], { env, stdio: ["ignore", "pipe", "pipe"] });
    this.proc = proc;
    let out = "";
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`server didn't start:\n${out}`)), WAIT_MS);
      const onData = (b: Buffer) => {
        out += b;
        if (out.includes("Point Poker on")) { clearTimeout(timer); resolve(); }
      };
      proc.stdout!.on("data", onData);
      proc.stderr!.on("data", (b: Buffer) => (out += b));
      proc.once("exit", (code) => { clearTimeout(timer); reject(new Error(`server exited (${code}):\n${out}`)); });
    });
  }

  /** Sends SIGINT, like Fly does on a deploy, and waits for the server to save and exit. */
  async stop() {
    const proc = this.proc;
    if (!proc || proc.exitCode !== null) return;
    this.proc = null;
    await new Promise<void>((resolve) => { proc.once("exit", () => resolve()); proc.kill("SIGINT"); });
  }

  cleanup() { rmSync(this.dataDir, { recursive: true, force: true }); }
}

type Hello = Omit<Extract<ClientMsg, { t: "join" }>, "t">;

/** One scripted player: a socket plus everything it has received. */
class Player {
  readonly msgs: ServerMsg[] = [];
  state: RoomState | null = null;
  id = "";
  token = "";
  isDealer = false;
  closed: { code: number; reason: string } | null = null;
  private ws: WebSocket;
  private checks = new Set<() => void>();

  private constructor(url: string) {
    this.ws = new WebSocket(url);
    this.ws.onmessage = (e) => {
      const m = JSON.parse(String(e.data)) as ServerMsg;
      this.msgs.push(m);
      if (m.t === "welcome") { this.id = m.playerId; this.token = m.token; this.isDealer = m.isDealer; }
      if (m.t === "state") this.state = m.state;
      this.check();
    };
    this.ws.onclose = (e) => { this.closed = { code: e.code, reason: e.reason }; this.check(); };
  }

  static async join(server: Server, code: string, hello: Hello): Promise<Player> {
    const p = new Player(`${server.ws}?room=${code}`);
    await new Promise<void>((resolve, reject) => {
      p.ws.onopen = () => resolve();
      p.ws.onerror = () => reject(new Error("socket error"));
    });
    p.send({ t: "join", ...hello });
    await p.until((x) => (!!x.id && !!x.state) || !!x.closed, "welcome");
    return p;
  }

  send(m: ClientMsg) { this.ws.send(JSON.stringify(m)); }
  close() { this.ws.close(); return this.until((x) => !!x.closed, "close"); }

  private check() { for (const c of [...this.checks]) c(); }

  /** Resolves once `pred` holds, checking again after every message. */
  until(pred: (p: Player) => boolean, label: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const done = () => { if (pred(this)) { clearTimeout(timer); this.checks.delete(done); resolve(); } };
      const timer = setTimeout(() => { this.checks.delete(done); reject(new Error(`timed out waiting for ${label}`)); }, WAIT_MS);
      this.checks.add(done);
      done();
    });
  }

  untilState(pred: (s: RoomState) => boolean, label: string) {
    return this.until((p) => !!p.state && pred(p.state), label);
  }

  player(id: string) { return this.state?.players.find((p) => p.id === id); }
  toasts() { return this.msgs.filter((m) => m.t === "toast").map((m) => (m as { text: string }).text); }
}

const look = (name: string) => ({ name, color: "#3bceac", hat: "tophat" as const, body: "bean" as const });

test("a whole session over real sockets, including a restart", async (t) => {
  const server = new Server();
  t.after(async () => { await server.stop(); server.cleanup(); });
  await server.start();

  // ---- opening a table needs the host passcode
  const denied = await fetch(`${server.http}/api/rooms`, { method: "POST" });
  assert.equal(denied.status, 401);
  const opened = await fetch(`${server.http}/api/rooms`, { method: "POST", headers: { "x-host-passcode": PASSCODE } });
  assert.equal(opened.status, 200);
  const { code, dealerKey } = await opened.json() as { code: string; dealerKey: string };
  assert.match(code, /^[A-Z]{4}$/);
  const info = await (await fetch(`${server.http}/api/rooms/${code.toLowerCase()}`)).json();
  assert.deepEqual(info, { exists: true, jiraEnabled: false, needsPasscode: true });
  assert.equal((await fetch(`${server.http}/api/rooms/ZZZZ`)).status, 404);

  // ---- everyone sits down
  const deb = await Player.join(server, code, { ...look("Deb"), dealerKey });
  assert.equal(deb.isDealer, true);
  const ann = await Player.join(server, code, look("Ann"));
  const bob = await Player.join(server, code, { ...look("Bob"), hat: "crown", body: "chonk" });
  assert.equal(ann.isDealer, false);
  await deb.untilState((s) => s.players.length === 3, "three players");
  assert.equal(deb.player(deb.id)?.seat, -1);
  assert.deepEqual([ann, bob].map((p) => deb.player(p.id)?.seat).sort(), [0, 1]);
  assert.equal(deb.player(bob.id)?.body, "chonk");

  // ---- only the dealer runs the round
  ann.send({ t: "reveal" });
  await ann.until((p) => p.toasts().includes("Only the dealer can do that"), "role error");

  // ---- a round: vote, change a vote, reveal, settle, re-settle
  deb.send({ t: "manualTicket", key: "", summary: "Login page", description: "" });
  await ann.untilState((s) => s.phase === "voting" && s.round === 1, "voting");
  assert.equal(ann.state!.ticket?.key, "TICKET");
  assert.equal(ann.state!.ticket?.summary, "Login page");

  ann.send({ t: "vote", value: 2 });
  bob.send({ t: "vote", value: 5 });
  await deb.untilState((s) => s.players.filter((p) => p.hasVoted).length === 2, "two votes in");
  ann.send({ t: "vote", value: 3 });
  await bob.until((p) => p.msgs.some((m) => m.t === "adjust" && m.id === ann.id), "adjust");
  assert.ok(!ann.msgs.some((m) => m.t === "adjust"), "the voter isn't told about their own adjust");

  // nobody's card leaks before the reveal
  for (const p of [deb, ann, bob]) {
    for (const m of p.msgs) {
      if (m.t === "state") assert.ok(m.state.players.every((x) => x.vote === null) && m.state.pot === 0, "vote leaked before reveal");
    }
  }

  deb.send({ t: "reveal" });
  await bob.untilState((s) => s.phase === "revealed", "revealed");
  assert.equal(bob.player(ann.id)?.vote, 3);
  assert.equal(bob.player(bob.id)?.vote, 5);
  assert.equal(bob.state!.pot, 8);

  deb.send({ t: "settle", finalPoints: 5 });
  await ann.untilState((s) => s.phase === "settled" && s.finalPoints === 5, "settled at 5");
  assert.deepEqual(ann.state!.winners, [bob.id]);
  assert.equal(ann.player(bob.id)?.chips, 8);
  assert.equal(ann.state!.houseWon, false);

  deb.send({ t: "settle", finalPoints: 2 });
  await ann.untilState((s) => s.finalPoints === 2, "re-settled at 2");
  assert.deepEqual(ann.state!.winners, [ann.id]);
  assert.equal(ann.player(ann.id)?.chips, 8);
  assert.equal(ann.player(bob.id)?.chips, 0, "the first payout is taken back");
  assert.equal(ann.state!.history.length, 1);
  assert.equal(ann.state!.history[0].finalPoints, 2);

  // ---- nobody close enough: the house rakes it in
  deb.send({ t: "nextRound" });
  await ann.untilState((s) => s.phase === "waiting" && !s.ticket, "back to waiting");
  deb.send({ t: "manualTicket", key: "SD-2", summary: "Search", description: "" });
  await ann.untilState((s) => s.phase === "voting" && s.round === 2, "round 2");
  ann.send({ t: "vote", value: 1 });
  bob.send({ t: "vote", value: 1 });
  await deb.untilState((s) => s.players.filter((p) => p.hasVoted).length === 2, "round 2 votes");
  deb.send({ t: "reveal" });
  deb.send({ t: "settle", finalPoints: 8 });
  await bob.untilState((s) => s.phase === "settled", "house round settled");
  assert.equal(bob.state!.houseWon, true);
  assert.deepEqual(bob.state!.winners, [deb.id]);
  assert.equal(bob.player(deb.id)?.chips, 2);

  // ---- skip and cancel pay nobody
  deb.send({ t: "nextRound" });
  deb.send({ t: "manualTicket", key: "SD-3", summary: "Signup", description: "" });
  await ann.untilState((s) => s.round === 3 && s.phase === "voting", "round 3");
  ann.send({ t: "vote", value: 5 });
  deb.send({ t: "skip" });
  await ann.untilState((s) => s.phase === "waiting" && s.skipped.includes("SD-3"), "skipped");
  await ann.until((p) => p.toasts().includes("⏭️ The dealer skipped SD-3"), "skip toast");
  assert.equal(ann.player(ann.id)?.chips, 8);

  deb.send({ t: "manualTicket", key: "SD-4", summary: "Cancel me", description: "" });
  await ann.untilState((s) => s.ticket?.key === "SD-4", "round 4");
  deb.send({ t: "cancelRound" });
  await ann.untilState((s) => s.phase === "waiting" && !s.ticket, "cancelled");
  await bob.until((p) => p.toasts().includes("🎩 The dealer cancelled this round"), "cancel toast");

  // ---- kick: the player is gone and can't come back
  const cat = await Player.join(server, code, look("Cat"));
  await deb.untilState((s) => s.players.length === 4, "cat sat down");
  deb.send({ t: "kick", id: cat.id });
  await cat.until((p) => p.closed?.code === 4001, "cat kicked");
  assert.equal(cat.closed!.reason, "Removed by the dealer");
  await ann.untilState((s) => s.players.length === 3, "cat gone");
  await ann.until((p) => p.toasts().includes("👋 Cat was removed from the table"), "kick toast");
  const catAgain = await Player.join(server, code, { ...look("Cat"), token: cat.token });
  assert.equal(catAgain.closed?.code, 4001);

  // ---- reconnect with a seat token
  await ann.close();
  await deb.untilState((s) => s.players.find((p) => p.id === ann.id)?.connected === false, "ann away");
  const ann2 = await Player.join(server, code, { ...look("Ann"), token: ann.token });
  assert.equal(ann2.id, ann.id);
  await deb.untilState((s) => s.players.find((p) => p.id === ann.id)?.connected === true, "ann back");
  assert.equal(ann2.player(ann.id)?.chips, 8);
  // the same seat opened in another tab takes over
  const ann3 = await Player.join(server, code, { ...look("Ann"), token: ann.token });
  await ann2.until((p) => p.closed?.code === 4002, "older tab closed");
  assert.equal(ann3.id, ann.id);

  // ---- restart: saved tables come back and everyone reconnects to their seat
  await server.stop();
  await Promise.all([deb, bob, ann3].map((p) => p.until((x) => !!x.closed, "server gone")));
  await server.start();
  const back = await (await fetch(`${server.http}/api/rooms/${code}`)).json();
  assert.equal(back.exists, true);
  const deb2 = await Player.join(server, code, { ...look("Deb"), dealerKey });
  assert.equal(deb2.id, deb.id);
  assert.equal(deb2.isDealer, true);
  const ann4 = await Player.join(server, code, { ...look("Ann"), token: ann.token });
  assert.equal(ann4.id, ann.id);
  await ann4.untilState((s) => s.players.length === 3, "everyone restored");
  assert.equal(ann4.player(ann.id)?.chips, 8);
  assert.equal(ann4.player(deb.id)?.chips, 2);
  assert.equal(ann4.player(bob.id)?.connected, false);
  assert.deepEqual(ann4.state!.history.map((h) => [h.key, h.finalPoints]), [["TICKET", 2], ["SD-2", 8]]);
  assert.deepEqual(ann4.state!.skipped, ["SD-3"]);
  const catAfter = await Player.join(server, code, { ...look("Cat"), token: cat.token });
  assert.equal(catAfter.closed?.code, 4001, "bans survive a restart");

  for (const p of [deb2, ann4]) await p.close();
});
