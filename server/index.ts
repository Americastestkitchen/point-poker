// HTTP + WebSocket server: serves the built client and runs the rooms.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { WebSocketServer, type WebSocket } from "ws";
import {
  BODIES, COLORS, DECK, EMOTES, HATS, MAX_PLAYERS, type Body,
  type ClientMsg, type Hat, type PublicPlayer, type RoomState, type ServerMsg, type Ticket,
} from "../shared/protocol.ts";
import { settle } from "./game.ts";
import { loadRooms, persistEnabled, saveRooms } from "./persist.ts";
import { defaultProject, defaultQueueJql, epicChildrenJql, fetchTicket, jiraEnabled, parseIssueKey, searchTickets } from "./jira.ts";

const PORT = Number(process.env.PORT ?? 8787);
// Opening a table (and so using the Jira token) needs this when set. Players only need the invite link.
const HOST_PASSCODE = process.env.HOST_PASSCODE ?? "";
const DIST = join(import.meta.dirname, "..", "dist");

interface Player {
  id: string;
  token: string;
  name: string;
  color: string;
  hat: Hat;
  body: Body;
  seat: number;
  isDealer: boolean;
  socket: WebSocket | null;
  vote: number | null;
  chips: number;
  lastWin: number;
}

interface Room {
  code: string;
  dealerKey: string;
  players: Map<string, Player>;
  phase: RoomState["phase"];
  round: number;
  ticket: Ticket | null;
  finalPoints: number | null;
  winners: string[];
  share: number;
  houseWon: boolean;
  pot: number;
  history: RoomState["history"];
  skipped: Set<string>;
  /** Tokens of players the dealer kicked; they can't rejoin this table. */
  banned: Set<string>;
  dealerPlays: boolean;
  epic: RoomState["epic"];
  queue: RoomState["queue"];
  queueLabel: string;
  lastActive: number;
}

// tables saved before the last restart come back; players reconnect to them on their own
const rooms: Map<string, Room> = loadRooms();

function newCode(): string {
  const letters = "BCDFGHJKLMNPQRSTVWXZ";
  let code;
  do {
    code = Array.from(randomBytes(4), (b) => letters[b % letters.length]).join("");
  } while (rooms.has(code));
  return code;
}

function createRoom(): Room {
  const room: Room = {
    code: newCode(), dealerKey: randomUUID(), players: new Map(), phase: "waiting", round: 0,
    ticket: null, finalPoints: null, winners: [], share: 0, houseWon: false, pot: 0, history: [], skipped: new Set(), banned: new Set(), dealerPlays: false, epic: null, queue: [], queueLabel: "",
    lastActive: Date.now(),
  };
  rooms.set(room.code, room);
  return room;
}

const isVoter = (room: Room, p: Player) => !p.isDealer || room.dealerPlays;

function publicState(room: Room): RoomState {
  const showVotes = room.phase === "revealed" || room.phase === "settled";
  const players: PublicPlayer[] = [...room.players.values()].map((p) => ({
    id: p.id, name: p.name, color: p.color, hat: p.hat, body: p.body, seat: p.seat, isDealer: p.isDealer,
    connected: p.socket !== null, plays: isVoter(room, p), hasVoted: p.vote !== null,
    vote: showVotes ? p.vote : null, chips: p.chips, lastWin: p.lastWin,
  }));
  return {
    code: room.code, phase: room.phase, round: room.round, ticket: room.ticket, players,
    pot: showVotes ? room.pot : 0, finalPoints: room.finalPoints, winners: room.winners,
    share: room.share, houseWon: room.houseWon, history: room.history.slice(-100), skipped: [...room.skipped], jiraEnabled, dealerPlays: room.dealerPlays,
    epic: room.epic, queueLabel: room.queueLabel,
    queue: room.queue.map((q) => ({ ...q, played: room.history.some((h) => h.key === q.key) || room.skipped.has(q.key) })),
  };
}

function send(ws: WebSocket | null, msg: ServerMsg) {
  if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

function broadcast(room: Room, msg: ServerMsg, except?: string) {
  const data = JSON.stringify(msg);
  for (const p of room.players.values()) {
    if (p.id !== except && p.socket && p.socket.readyState === p.socket.OPEN) p.socket.send(data);
  }
}

const pushState = (room: Room) => broadcast(room, { t: "state", state: publicState(room) });

function freeSeat(room: Room): number {
  const taken = new Set([...room.players.values()].map((p) => p.seat));
  for (let i = 0; i < MAX_PLAYERS; i++) if (!taken.has(i)) return i;
  return -2;
}

const clean = (s: unknown, max: number) => String(s ?? "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, max);
const pickColor = (c: unknown) => (COLORS as readonly string[]).includes(String(c)) ? String(c) : COLORS[0];
const pickHat = (h: unknown): Hat => (HATS as readonly string[]).includes(String(h)) ? (h as Hat) : "none";
const pickBody = (b: unknown): Body => (BODIES as readonly string[]).includes(String(b)) ? (b as Body) : "bean";

function startRound(room: Room) {
  room.phase = "voting";
  room.round += 1;
  room.finalPoints = null;
  room.winners = [];
  room.share = 0;
  room.houseWon = false;
  room.pot = 0;
  for (const p of room.players.values()) { p.vote = null; p.lastWin = 0; }
}

function resetTable(room: Room) {
  room.phase = "waiting";
  room.finalPoints = null;
  room.winners = [];
  room.share = 0;
  room.houseWon = false;
  room.pot = 0;
  for (const p of room.players.values()) { p.vote = null; p.lastWin = 0; }
}

/** First queued ticket that hasn't been played yet, preferring ones with no points. */
function nextInQueue(room: Room) {
  const played = new Set([...room.history.map((h) => h.key), ...room.skipped]);
  if (room.ticket) played.add(room.ticket.key);
  const open = room.queue.filter((q) => !played.has(q.key));
  return open.find((q) => q.points === null) ?? open[0];
}

/** Loads a ticket; an epic instead fills the queue with its children and loads the first one. */
async function loadTicket(room: Room, ref: string) {
  const ticket = await fetchTicket(ref);
  if (ticket.type.toLowerCase() === "epic") {
    const children = await searchTickets(epicChildrenJql(ticket.key));
    if (children.length === 0) throw new Error("That epic has no child tickets");
    room.epic = { key: ticket.key, summary: ticket.summary, url: ticket.url };
    room.queue = children;
    room.queueLabel = `Epic ${ticket.key}`;
    const first = children.find((c) => c.points === null) ?? children[0];
    room.ticket = await fetchTicket(first.key);
  } else {
    room.ticket = ticket;
  }
  startRound(room);
  pushState(room);
}

function handle(room: Room, me: Player, msg: ClientMsg) {
  room.lastActive = Date.now();
  switch (msg.t) {
    case "vote": {
      if (room.phase !== "voting" || !isVoter(room, me)) return;
      const before = me.vote;
      me.vote = msg.value === null ? null : (DECK as readonly number[]).includes(msg.value) ? msg.value : null;
      if (before !== null && me.vote !== null && before !== me.vote) broadcast(room, { t: "adjust", id: me.id }, me.id);
      return pushState(room);
    }
    case "look":
      if (Number.isFinite(msg.yaw) && Number.isFinite(msg.pitch)) {
        broadcast(room, { t: "look", id: me.id, yaw: msg.yaw, pitch: msg.pitch }, me.id);
      }
      return;
    case "talk": {
      const level = Number(msg.level);
      if (!Number.isFinite(level)) return;
      broadcast(room, { t: "talk", id: me.id, level: Math.round(Math.min(1, Math.max(0, level)) * 100) / 100 }, me.id);
      return;
    }
    case "emote":
      if ((EMOTES as readonly string[]).includes(msg.kind)) broadcast(room, { t: "emote", id: me.id, kind: msg.kind });
      return;
    case "flick":
      if (room.players.has(msg.target) && msg.target !== me.id) broadcast(room, { t: "flick", from: me.id, to: msg.target });
      return;
    case "style":
      me.color = pickColor(msg.color);
      me.hat = pickHat(msg.hat);
      me.body = pickBody(msg.body);
      return pushState(room);
  }

  if (!me.isDealer) return send(me.socket, { t: "toast", text: "Only the dealer can do that", level: "error" });

  switch (msg.t) {
    case "loadTicket": {
      const key = parseIssueKey(msg.ref);
      if (!key) return send(me.socket, { t: "loadFailed", text: "That doesn't look like a Jira link or key (like SD-1234)" });
      loadTicket(room, msg.ref).catch((e) => send(me.socket, { t: "loadFailed", text: `${key}: ${e.message}` }));
      return;
    }
    case "manualTicket": {
      const summary = clean(msg.summary, 300);
      if (!summary) return;
      room.ticket = {
        key: clean(msg.key, 30) || "TICKET", summary, description: clean(msg.description, 6000),
        type: "", status: "", priority: "", assignee: "", reporter: "", labels: [], currentPoints: null, url: "",
        adf: null, statusCategory: "", parent: null,
      };
      startRound(room);
      return pushState(room);
    }
    case "fetchQueue": {
      const lastProject = room.ticket?.key.split("-")[0];
      const jql = clean(msg.jql, 500) || defaultQueueJql(lastProject && /^[A-Z][A-Z0-9_]+$/.test(lastProject) ? lastProject : defaultProject);
      searchTickets(jql)
        .then((tickets) => {
          room.queue = tickets;
          room.queueLabel = msg.jql ? "Custom search" : "Current & upcoming sprints";
          room.epic = null;
          pushState(room);
        })
        .catch((e) => send(me.socket, { t: "loadFailed", text: `Couldn't load the sprint: ${e.message}` }));
      return;
    }
    case "clearQueue":
      room.queue = [];
      room.queueLabel = "";
      room.epic = null;
      return pushState(room);
    case "dealerPlays":
      room.dealerPlays = Boolean(msg.plays);
      if (!room.dealerPlays) me.vote = null;
      return pushState(room);
    case "deal":
      if (!room.ticket) return send(me.socket, { t: "toast", text: "Load a ticket first", level: "error" });
      startRound(room);
      return pushState(room);
    case "reveal":
      if (room.phase !== "voting") return;
      room.phase = "revealed";
      room.pot = [...room.players.values()].reduce((sum, p) => sum + (p.vote ?? 0), 0);
      return pushState(room);
    case "settle": {
      if ((room.phase !== "revealed" && room.phase !== "settled") || !(DECK as readonly number[]).includes(msg.finalPoints)) return;
      if (room.phase === "settled") {
        // the dealer changed their mind: take back the last payout first
        for (const p of room.players.values()) {
          p.chips = Math.round((p.chips - p.lastWin) * 100) / 100;
          p.lastWin = 0;
        }
        room.history.pop();
      }
      const votes = new Map<string, number>();
      for (const p of room.players.values()) if (p.vote !== null && isVoter(room, p)) votes.set(p.id, p.vote);
      const result = settle(votes, msg.finalPoints);
      // nobody close enough: the house (dealer) rakes in the pot
      const dealer = [...room.players.values()].find((p) => p.isDealer);
      room.houseWon = !result.winners.length && result.pot > 0 && !!dealer;
      if (room.houseWon) { result.winners = [dealer!.id]; result.share = result.pot; }
      room.phase = "settled";
      room.finalPoints = msg.finalPoints;
      room.pot = result.pot;
      room.winners = result.winners;
      room.share = result.share;
      for (const id of result.winners) {
        const w = room.players.get(id)!;
        w.chips = Math.round((w.chips + result.share) * 100) / 100;
        w.lastWin = result.share;
      }
      room.history.push({
        key: room.ticket?.key ?? "?", summary: room.ticket?.summary ?? "", finalPoints: msg.finalPoints,
        pot: result.pot, share: result.share, winners: result.winners.map((id) => room.players.get(id)!.name), houseWon: room.houseWon,
      });
      // a permanent trail in the server logs (`fly logs`), so a forgotten Jira update can be recovered
      console.log("POINTED " + JSON.stringify({
        at: new Date().toISOString(), room: room.code, key: room.ticket?.key, summary: room.ticket?.summary,
        points: msg.finalPoints, votes: Object.fromEntries([...votes].map(([id, v]) => [room.players.get(id)?.name ?? id, v])),
      }));
      return pushState(room);
    }
    case "nextRound": {
      resetTable(room);
      room.ticket = null;
      const next = nextInQueue(room);
      if (next) {
        loadTicket(room, next.key).catch((e) => send(me.socket, { t: "loadFailed", text: `${next.key}: ${e.message}` }));
      }
      return pushState(room);
    }
    case "cancelRound": {
      if (room.phase === "waiting" && !room.ticket) return;
      if (room.phase === "settled") return; // already paid out; just pick the next ticket
      resetTable(room);
      room.ticket = null;
      broadcast(room, { t: "toast", text: "🎩 The dealer cancelled this round" }, me.id);
      return pushState(room);
    }
    case "skip": {
      if (!room.ticket || room.phase === "settled") return;
      const skippedKey = room.ticket.key;
      room.skipped.add(skippedKey);
      const next = nextInQueue(room);
      resetTable(room);
      room.ticket = null;
      broadcast(room, { t: "toast", text: `⏭️ The dealer skipped ${skippedKey}` }, me.id);
      if (next) loadTicket(room, next.key).catch((e) => send(me.socket, { t: "loadFailed", text: `${next.key}: ${e.message}` }));
      return pushState(room);
    }
    case "kick": {
      const p = room.players.get(msg.id);
      if (!p || p.isDealer) return;
      room.banned.add(p.token);
      p.socket?.close(4001, "Removed by the dealer");
      room.players.delete(p.id);
      broadcast(room, { t: "toast", text: `👋 ${p.name} was removed from the table` });
      return pushState(room);
    }
  }
}

// ---------- HTTP ----------

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css",
  ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".json": "application/json",
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://x");
  if (url.pathname === "/api/rooms" && req.method === "POST") {
    if (HOST_PASSCODE && req.headers["x-host-passcode"] !== HOST_PASSCODE) {
      res.writeHead(401, { "content-type": "application/json" });
      return res.end(JSON.stringify({ error: "Wrong host passcode" }));
    }
    const room = createRoom();
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify({ code: room.code, dealerKey: room.dealerKey }));
  }
  if (url.pathname.startsWith("/api/rooms/") && req.method === "GET") {
    const code = url.pathname.split("/").pop()!.toUpperCase();
    res.writeHead(rooms.has(code) ? 200 : 404, { "content-type": "application/json" });
    return res.end(JSON.stringify({ exists: rooms.has(code), jiraEnabled, needsPasscode: !!HOST_PASSCODE }));
  }
  // static files from dist/, falling back to index.html
  let path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
  let file = join(DIST, path);
  if (!file.startsWith(DIST)) { res.writeHead(403); return res.end(); }
  try {
    if (!(await stat(file)).isFile()) throw 0;
  } catch {
    file = join(DIST, "index.html");
  }
  try {
    const body = await readFile(file);
    const cache = file.includes("/assets/") ? "public, max-age=31536000, immutable" : "no-cache";
    res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream", "cache-control": cache });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("Client not built yet. Run `npm run build`.");
  }
});

// ---------- WebSocket ----------

const wss = new WebSocketServer({ server, path: "/ws", maxPayload: 32 * 1024 });

wss.on("connection", (ws, req) => {
  const code = new URL(req.url ?? "", "http://x").searchParams.get("room")?.toUpperCase() ?? "";
  const room = rooms.get(code);
  if (!room) return ws.close(4004, "No such room");
  let me: Player | null = null;

  ws.on("message", (raw) => {
    let msg: ClientMsg;
    try { msg = JSON.parse(String(raw)); } catch { return; }
    if (!me) {
      if (msg.t !== "join") return;
      const isDealer = msg.dealerKey === room.dealerKey;
      if (!isDealer && msg.token && room.banned.has(msg.token)) return ws.close(4001, "Removed by the dealer");
      const existing = [...room.players.values()].find((p) => p.token === msg.token || (isDealer && p.isDealer));
      if (existing) {
        existing.socket?.close(4002, "Joined from another tab");
        me = existing;
      } else {
        const seat = isDealer ? -1 : freeSeat(room);
        if (seat === -2) {
          send(ws, { t: "toast", text: "The table is full", level: "error" });
          return ws.close(4003, "Table full");
        }
        me = {
          id: randomUUID().slice(0, 8), token: randomUUID(), name: "", color: COLORS[0], hat: "none", body: "bean",
          seat, isDealer, socket: null, vote: null, chips: 0, lastWin: 0,
        };
        room.players.set(me.id, me);
      }
      me.name = clean(msg.name, 18) || (me.isDealer ? "Dealer" : "Mystery Bean");
      me.color = pickColor(msg.color);
      me.hat = pickHat(msg.hat);
      me.body = pickBody(msg.body);
      me.socket = ws;
      send(ws, { t: "welcome", playerId: me.id, token: me.token, isDealer: me.isDealer });
      pushState(room);
      return;
    }
    try {
      handle(room, me, msg);
    } catch (e) {
      console.error("message failed", msg.t, e);
    }
  });

  ws.on("close", () => {
    if (me && me.socket === ws) {
      me.socket = null;
      pushState(room);
    }
  });
});

// Forget rooms nobody has touched for six hours.
setInterval(() => {
  const cutoff = Date.now() - 6 * 3600_000;
  for (const [code, room] of rooms) {
    const anyone = [...room.players.values()].some((p) => p.socket);
    if (!anyone && room.lastActive < cutoff) rooms.delete(code);
  }
}, 10 * 60_000).unref();

// Save tables every few seconds, and once more on shutdown (Fly sends SIGINT on deploys).
if (persistEnabled) {
  setInterval(() => saveRooms(rooms), 5_000).unref();
  for (const sig of ["SIGINT", "SIGTERM"] as const) {
    process.on(sig, () => {
      saveRooms(rooms);
      console.log(`saved ${rooms.size} table(s), shutting down`);
      process.exit(0);
    });
  }
}

server.listen(PORT, () => {
  console.log(`Point Poker on http://localhost:${PORT} (Jira ${jiraEnabled ? "connected" : "not configured"}, ` +
    `${persistEnabled ? `${rooms.size} saved table(s) restored` : "tables not saved"})`);
});
