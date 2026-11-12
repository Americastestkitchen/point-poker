import * as THREE from "three";
import {
  BODIES, COLORS, DECK, HATS,
  type Body, type Emote, type Hat, type PublicPlayer, type RoomState, type ServerMsg,
} from "../../shared/protocol.ts";
import { Avatar } from "./avatar.ts";
import { Net } from "./net.ts";
import { sfx } from "./sfx.ts";
import { Hud } from "./hud.ts";
import { Mic } from "./mic.ts";
import { TABLE_Y, TableCard, World, makeChip, seatInfo, stackChips } from "./world.ts";
import "./style.css";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];

const params = new URLSearchParams(location.search);
const roomCode = (params.get("room") ?? "").toUpperCase();
const dealerKey = roomCode ? localStorage.getItem(`pp-dealer-${roomCode}`) ?? undefined : undefined;
const tokenKey = `pp-token-${roomCode}`;

const HAT_ICON: Record<Hat, [string, string]> = {
  none: ["🫥", "bare"], beanie: ["🧢", "propeller"], tophat: ["🎩", "top hat"], cone: ["🚧", "cone"],
  party: ["🥳", "party"], chef: ["🧑‍🍳", "chef"], horns: ["🪖", "viking"], fez: ["🔴", "fez"], crown: ["👑", "crown"],
};
const BODY_ICON: Record<Body, [string, string]> = {
  bean: ["🫘", "bean"], chonk: ["🍔", "chonk"], noodle: ["🍝", "noodle"], box: ["📦", "box"], pear: ["🍐", "pear"],
};
const EMOTE_KEYS: Record<string, Emote> = { z: "wave", x: "laugh", c: "think", v: "shock" };

const saved = JSON.parse(localStorage.getItem("pp-me") ?? "{}") as { name?: string; color?: string; hat?: Hat; body?: Body };
const look = {
  name: saved.name ?? "",
  color: saved.color && (COLORS as readonly string[]).includes(saved.color) ? saved.color : pick(COLORS),
  hat: saved.hat && (HATS as readonly string[]).includes(saved.hat) ? saved.hat : pick(HATS.slice(1)),
  body: saved.body && (BODIES as readonly string[]).includes(saved.body) ? saved.body : pick(BODIES),
};

// ======================================================================
// Lobby + character creator
// ======================================================================

let preview: { renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; avatar: Avatar } | null = null;
let inGame = false;

function toastIn(text: string, level: "info" | "error" = "info") {
  const el = document.createElement("div");
  el.className = `toast ${level}`;
  el.textContent = text;
  $("toasts").append(el);
  setTimeout(() => el.remove(), 4200);
}

async function openTable() {
  const tryOpen = (pass: string) => fetch("/api/rooms", { method: "POST", headers: { "x-host-passcode": pass } });
  let pass = localStorage.getItem("pp-host-pass") ?? "";
  let res = await tryOpen(pass);
  while (res.status === 401) {
    const typed = prompt(pass ? "That passcode didn't work. Host passcode:" : "Host passcode (only needed to open a table):");
    if (typed === null) return;
    pass = typed.trim();
    res = await tryOpen(pass);
  }
  if (!res.ok) return alert("Couldn't open a table, try again.");
  localStorage.setItem("pp-host-pass", pass);
  const { code, dealerKey } = await res.json();
  localStorage.setItem(`pp-dealer-${code}`, dealerKey);
  location.search = `?room=${code}`;
}

async function bootLobby() {
  if (!roomCode) {
    $("start-view").hidden = false;
    $("creator-view").hidden = true;
    $("new-table").onclick = openTable;
    $("join-code").onsubmit = (e) => {
      e.preventDefault();
      const code = $<HTMLInputElement>("code-input").value.trim().toUpperCase();
      if (code) location.search = `?room=${code}`;
    };
    return;
  }
  const res = await fetch(`/api/rooms/${roomCode}`).then((r) => r.json()).catch(() => ({ exists: false }));
  if (!res.exists) {
    $("start-view").hidden = false;
    $("creator-view").hidden = true;
    $("start-view").insertAdjacentHTML("afterbegin", `<div class="toast error">Table ${esc(roomCode)} isn't open anymore. Start a new one?</div>`);
    history.replaceState(null, "", location.pathname);
    params.delete("room");
    $("new-table").onclick = openTable;
    $("join-code").onsubmit = (e) => {
      e.preventDefault();
      location.search = `?room=${$<HTMLInputElement>("code-input").value.trim().toUpperCase()}`;
    };
    return;
  }
  openCreator();
}

function openCreator() {
  $("lobby").hidden = false;
  $("start-view").hidden = true;
  $("creator-view").hidden = false;
  $("dealer-badge").hidden = !dealerKey;
  $("sit").textContent = inGame ? "Done" : dealerKey ? "Open the table →" : "Join the table →";
  ($("look-more") as HTMLDetailsElement).open = inGame;
  const nameIn = $<HTMLInputElement>("name-input");
  nameIn.value = look.name;
  nameIn.oninput = () => (look.name = nameIn.value);

  const colors = $("colors");
  colors.innerHTML = "";
  for (const c of COLORS) {
    const b = document.createElement("button");
    b.type = "button";
    b.style.background = c;
    b.className = c === look.color ? "on" : "";
    b.onclick = () => { look.color = c; sfx.pop(); openCreatorRefresh(); };
    colors.append(b);
  }
  const bodies = $("bodies");
  bodies.innerHTML = "";
  for (const b of BODIES) {
    const el = document.createElement("button");
    el.type = "button";
    el.innerHTML = `${BODY_ICON[b][0]}<span>${BODY_ICON[b][1]}</span>`;
    el.className = b === look.body ? "on" : "";
    el.onclick = () => { look.body = b; sfx.pop(); openCreatorRefresh(); };
    bodies.append(el);
  }
  const hats = $("hats");
  hats.innerHTML = "";
  for (const h of HATS) {
    const b = document.createElement("button");
    b.type = "button";
    b.innerHTML = `${HAT_ICON[h][0]}<span>${HAT_ICON[h][1]}</span>`;
    b.className = h === look.hat ? "on" : "";
    b.onclick = () => { look.hat = h; sfx.pop(); openCreatorRefresh(); };
    hats.append(b);
  }
  startPreview();
  $("sit-form").onsubmit = (e) => {
    e.preventDefault();
    look.name = nameIn.value.trim() || look.name;
    if (!look.name) { nameIn.focus(); nameIn.classList.add("nudge"); setTimeout(() => nameIn.classList.remove("nudge"), 500); return; }
    localStorage.setItem("pp-me", JSON.stringify(look));
    $("lobby").hidden = true;
    if (inGame) net.send({ t: "style", color: look.color, hat: look.hat, body: look.body });
    else startGame();
  };
  setTimeout(() => nameIn.focus(), 50);
}

function openCreatorRefresh() {
  [...$("colors").children].forEach((b, i) => b.classList.toggle("on", COLORS[i] === look.color));
  [...$("hats").children].forEach((b, i) => b.classList.toggle("on", HATS[i] === look.hat));
  [...$("bodies").children].forEach((b, i) => b.classList.toggle("on", BODIES[i] === look.body));
  if (preview && preview.avatar.shape !== look.body) {
    preview.scene.remove(preview.avatar.group);
    preview.avatar = new Avatar("preview", look.color, look.hat, !!dealerKey, look.body);
    preview.scene.add(preview.avatar.group);
  }
  preview?.avatar.setStyle(look.color, look.hat);
  preview?.avatar.playEmote("wave");
}

function startPreview() {
  const canvas = $<HTMLCanvasElement>("preview");
  if (!preview) {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 20);
    camera.position.set(0, 1.25, 3.3);
    camera.lookAt(0, 1.0, 0);
    scene.add(new THREE.HemisphereLight("#ffd9c0", "#301020", 1.6));
    const key = new THREE.DirectionalLight("#fff0d8", 2.2);
    key.position.set(1.5, 3, 2);
    scene.add(key);
    const avatar = new Avatar("preview", look.color, look.hat, !!dealerKey, look.body);
    scene.add(avatar.group);
    preview = { renderer, scene, camera, avatar };
    const clock = new THREE.Clock();
    const loop = () => {
      if ($("lobby").hidden) { requestAnimationFrame(loop); return; }
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (canvas.width !== Math.floor(w * devicePixelRatio) || canvas.height !== Math.floor(h * devicePixelRatio)) {
        renderer.setPixelRatio(devicePixelRatio);
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
      const dt = Math.min(clock.getDelta(), 0.1), t = clock.elapsedTime;
      const av = preview!.avatar;
      av.group.rotation.y = Math.sin(t * 0.6) * 0.7;
      av.setLook(Math.sin(t * 1.3) * 0.6, Math.sin(t * 0.9) * 0.3);
      av.update(dt, t);
      renderer.render(scene, camera);
      requestAnimationFrame(loop);
    };
    loop();
  }
  preview.avatar.setStyle(look.color, look.hat);
}

// ======================================================================
// The game
// ======================================================================

let world: World;
let net: Net;
let me = { id: "", isDealer: false };
let state: RoomState | null = null;
let hud: Hud;

interface Seat {
  avatar: Avatar;
  card: TableCard;
  stack: THREE.Group;
  pos: THREE.Vector3;
  facing: number;
  slot: number;
  chipsShown: number;
}
const seats = new Map<string, Seat>();
const camPos = new THREE.Vector3(0, 1.3, 3);
const camTarget = new THREE.Vector3(0, 1.3, 3);
let baseYaw = 0, basePitch = 0;
const view = { yaw: 0, pitch: 0, sentYaw: 0, sentPitch: 0 };

interface Flight { obj: THREE.Object3D; from: THREE.Vector3; to: THREE.Vector3 | (() => THREE.Vector3); t: number; dur: number; arc: number; spin: number; done?: () => void }
const flights: Flight[] = [];


const myPlayer = () => state?.players.find((p) => p.id === me.id);

function startGame() {
  inGame = true;
  $("hud").hidden = false;
  world = new World($<HTMLCanvasElement>("scene"));
  world.resize();
  addEventListener("resize", () => world.resize());
  hud = new Hud({ send: (m) => net.send(m), playCard: (v) => playCard(DECK.indexOf(v as (typeof DECK)[number])), openLook: () => openCreator(), roomCode });
  setupInput();
  sfx.ambience();
  $("wardrobe").style.setProperty("--me", look.color);

  net = new Net(roomCode, () => ({
    t: "join", name: look.name, color: look.color, hat: look.hat, body: look.body,
    token: sessionStorage.getItem(tokenKey) ?? localStorage.getItem(tokenKey) ?? undefined, dealerKey,
  }));
  net.onStatus = (s, reason) => {
    $("conn").textContent = s === "open" ? "" : s === "connecting" ? "reconnecting…" : `disconnected: ${reason ?? ""}`;
  };
  net.onMessage = onMessage;
  net.connect();
  setupMic();

  const clock = new THREE.Clock();
  const loop = () => {
    const dt = Math.min(clock.getDelta(), 0.1);
    frame(dt, clock.elapsedTime);
    requestAnimationFrame(loop);
  };
  loop();
}

function onMessage(m: ServerMsg) {
  switch (m.t) {
    case "welcome":
      me = { id: m.playerId, isDealer: m.isDealer };
      localStorage.setItem(tokenKey, m.token);
      hud.setMe(m.playerId, m.isDealer);
      return;
    case "state": {
      const prev = state;
      state = m.state;
      applyState(prev, m.state);
      return;
    }
    case "look": seats.get(m.id)?.avatar.setLook(m.yaw, m.pitch); return;
    case "emote": {
      const s = seats.get(m.id);
      s?.avatar.playEmote(m.kind);
      sfx.pop();
      return;
    }
    case "flick": flick(m.from, m.to); return;
    case "talk": seats.get(m.id)?.avatar.setTalk(m.level); return;
    case "adjust": {
      // someone swapped their card: they reach in and fiddle with it
      const s = seats.get(m.id);
      if (s && s.card.group.visible) { s.avatar.adjustCard(); s.card.nudge(0.2); }
      return;
    }
    case "toast": hud.toast(m.text, m.level); if (m.level === "error") sfx.bonk(); return;
    case "loadFailed": hud.loadFailed(m.text); return;
  }
}

// ---------------- state → scene ----------------

function applyState(prev: RoomState | null, st: RoomState) {
  const players = st.players.filter((p) => !p.isDealer).sort((a, b) => a.seat - b.seat);
  const count = players.length;
  const slotOf = new Map<string, number>(players.map((p, i) => [p.id, i]));
  const phaseChanged = prev?.phase !== st.phase || prev?.round !== st.round;
  const revealed = st.phase === "revealed" || st.phase === "settled";

  // remove people who left
  for (const [id, seat] of seats) {
    if (!st.players.some((p) => p.id === id)) {
      world.scene.remove(seat.avatar.group, seat.card.group, seat.stack);
      seats.delete(id);
    }
  }

  let flipIndex = 0;
  for (const p of st.players) {
    const slot = p.isDealer ? -1 : slotOf.get(p.id)!;
    let seat = seats.get(p.id);
    const info = seatInfo(slot, count);
    if (!seat) {
      const avatar = new Avatar(p.id, p.color, p.hat, p.isDealer, p.body);
      avatar.group.position.set(info.x, 0, info.z);
      avatar.group.rotation.y = info.facing;
      const stack = new THREE.Group();
      world.scene.add(avatar.group, stack);
      seat = { avatar, card: new TableCard(world.scene), stack, pos: new THREE.Vector3(info.x, 0, info.z), facing: info.facing, slot, chipsShown: -1 };
      seats.set(p.id, seat);
      if (prev && p.id !== me.id) { avatar.playEmote("wave"); sfx.pop(); }
    }
    if (seat.avatar.shape !== p.body) {
      // new body shape: swap the model in place
      const old = seat.avatar;
      const avatar = new Avatar(p.id, p.color, p.hat, p.isDealer, p.body);
      avatar.group.position.copy(old.group.position);
      avatar.group.rotation.y = old.group.rotation.y;
      world.scene.remove(old.group);
      world.scene.add(avatar.group);
      seat.avatar = avatar;
      if (prev && p.id !== me.id) { avatar.playEmote("shock"); sfx.pop(); }
    }
    if (p.id === me.id) $("wardrobe").style.setProperty("--me", p.color);
    seat.slot = slot;
    seat.pos.set(info.x, 0, info.z);
    seat.facing = info.facing;
    seat.card.placeAt(slot, count, p.id === me.id ? 0.42 : 0.62);
    seat.stack.position.copy(info.toward(0.7)).addScaledVector(info.side, -0.24);
    seat.avatar.setStyle(p.color, p.hat);
    seat.avatar.setTag(p.name + (p.isDealer ? " 🎩" : ""), p.chips, p.color, p.connected);
    seat.avatar.group.visible = p.id !== me.id;
    seat.card.noFloat = p.id === me.id;

    if (p.id === me.id) {
      camTarget.set(info.x * 1.06, p.isDealer ? 1.6 : 1.5, info.z * 1.06);
      if (!prev) camPos.copy(camTarget);
    }

    // speech bubble showing whether they've bet
    seat.avatar.setBubble(st.phase === "voting" && p.plays ? (p.hasVoted ? "✓" : "…") : "");

    // their card on the felt
    if (st.phase === "voting") {
      if (p.hasVoted) {
        const mine = p.id === me.id ? myVote : null;
        if (!seat.card.group.visible) {
          if (p.id === me.id) {
            seat.card.show(mine, world.camera.localToWorld(new THREE.Vector3(0, -0.3, -0.5)));
            seat.card.nudge(0.5);
            sfx.slide();
          } else {
            // they lean in, set it down from their hand, then square it up
            const av = seat.avatar;
            av.placeCard();
            seat.card.show(mine, () => av.handWorldPos(), { delay: 0.3, gentle: true });
            seat.card.nudge(0.75);
            setTimeout(sfx.slide, 300);
          }
        } else seat.card.show(mine);
        seat.card.faceUp(false);
      } else seat.card.hide();
    } else if (revealed && p.vote !== null) {
      if (!seat.card.group.visible) seat.card.show(null);
      if (!seat.card.isFaceUp) {
        const card = seat.card, value = p.vote, delay = phaseChanged ? 250 * flipIndex++ : 0;
        setTimeout(() => { card.show(value); card.faceUp(true); if (delay || phaseChanged) sfx.flip(); }, delay);
        card.faceUp(true);
        card.show(card.value);
      }
    } else seat.card.hide();

    // personal chip stack (winners' stacks update after the chips land)
    if (seat.chipsShown !== p.chips && !(st.phase === "settled" && phaseChanged && st.winners.includes(p.id) && prev)) {
      stackChips(seat.stack, p.chips, p.seat + 7);
      seat.chipsShown = p.chips;
    }
  }

  if (phaseChanged) {
    if (st.phase === "voting") { myVote = null; sfx.deal(); }
  }
  if (st.phase !== "voting") myVote = null;
  // keep our local idea of our vote in sync with the server after a reconnect
  const mp = st.players.find((p) => p.id === me.id);
  if (st.phase === "voting" && mp && !mp.hasVoted) myVote = null;

  // the pot
  if (st.phase === "revealed") {
    if (phaseChanged || !world.pot.children.length) {
      stackChips(world.pot, st.pot, 99);
      world.pot.children.forEach((c, i) => {
        const to = c.position.clone();
        c.position.y += 0.6 + i * 0.01;
        flights.push({ obj: c, from: c.position.clone(), to, t: -i * 0.03, dur: 0.35, arc: 0, spin: 0, done: () => i % 3 === 0 && sfx.chip() });
      });
    }
  } else if (st.phase === "settled" && phaseChanged && prev) {
    payOut(st);
  } else if (st.phase !== "settled") {
    world.pot.clear();
  }

  const resettled = !phaseChanged && st.phase === "settled" && prev?.finalPoints !== st.finalPoints;
  if (resettled) { world.pot.clear(); }
  if (st.phase === "settled" && (phaseChanged || resettled)) {
    for (const id of st.winners) seats.get(id)?.avatar.celebrate();
    if (st.winners.includes(me.id)) sfx.win(); else if (prev) sfx.chip();
  }

  // ticket on the table, on the telly, and in the side panel
  const t = st.ticket;
  world.setTicket(t ? {
    key: t.key, type: t.type, summary: t.summary,
    points: st.finalPoints !== null && st.phase === "settled" ? `${st.finalPoints} PTS` : "",
  } : null);
  const voters = st.players.filter((p) => p.plays);
  const tvLine3 = st.phase === "voting" ? `${voters.filter((p) => p.hasVoted).length}/${voters.length} BETS IN`
    : st.phase === "revealed" ? `POT ${st.pot}` : st.phase === "settled" ? `FINAL ${st.finalPoints} PTS` : "";
  world.setTv(t?.key ?? "NO TICKET", t?.summary ?? "the dealer is shuffling the backlog", tvLine3);

  hud.setVote(myVote);
  hud.update(prev, st);
  document.title = `${t ? t.key + " · " : ""}Point Poker`;
}

function payOut(st: RoomState) {
  const winners = st.winners.map((id) => seats.get(id)).filter(Boolean) as Seat[];
  const chips = [...world.pot.children];
  if (!winners.length) { world.pot.clear(); return; }
  chips.forEach((chip, i) => {
    const seat = winners[i % winners.length];
    const from = chip.getWorldPosition(new THREE.Vector3());
    world.pot.remove(chip);
    world.scene.add(chip);
    chip.position.copy(from);
    flights.push({
      obj: chip, from, to: () => seat.stack.getWorldPosition(new THREE.Vector3()).setY(TABLE_Y + 0.05),
      t: -0.6 - i * 0.04, dur: 0.6, arc: 0.4, spin: 8,
      done: () => { world.scene.remove(chip); if (i % 2 === 0) sfx.chip(); },
    });
  });
  const total = 0.6 + chips.length * 0.04 + 0.7;
  setTimeout(() => {
    if (!state) return;
    for (const p of state.players) {
      const s = seats.get(p.id);
      if (s && s.chipsShown !== p.chips) { stackChips(s.stack, p.chips, p.seat + 7); s.chipsShown = p.chips; }
    }
  }, total * 1000);
}

// ---------------- the hand of cards ----------------

let myVote: number | null = null;

function playCard(i: number) {
  const st = state, p = myPlayer();
  if (!st || st.phase !== "voting" || !p?.plays) return;
  const v = DECK[i];
  const seat = seats.get(me.id);
  if (myVote === v) return;
  const had = myVote !== null;
  myVote = v;
  net.send({ t: "vote", value: v });
  if (seat) {
    const from = world.camera.localToWorld(new THREE.Vector3((i - 3.5) * 0.06, -0.35, -0.5));
    if (had) seat.card.hide();
    seat.card.show(v, from);
    seat.card.faceUp(false);
  }
  sfx.slide();
  hud.setVote(myVote);
}

// ---------------- chips flying at heads ----------------

function headOf(id: string): THREE.Vector3 {
  if (id === me.id) return world.camera.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, -0.05, 0));
  return seats.get(id)?.avatar.headWorldPos() ?? new THREE.Vector3();
}

function flick(from: string, to: string) {
  const chip = makeChip(pick(["#c0392b", "#2d6cdf", "#151515", "#e6be5a"]));
  const start = from === me.id ? world.camera.localToWorld(new THREE.Vector3(0.15, -0.2, -0.3)) : headOf(from);
  chip.position.copy(start);
  world.scene.add(chip);
  flights.push({
    obj: chip, from: start, to: () => headOf(to), t: 0, dur: 0.55, arc: 0.35, spin: 25,
    done: () => {
      sfx.bonk();
      if (to === me.id) {
        const f = $("bonk-flash");
        f.classList.remove("on"); void f.offsetWidth; f.classList.add("on");
        document.body.classList.add("shake");
        setTimeout(() => document.body.classList.remove("shake"), 360);
      } else seats.get(to)?.avatar.bonk();
      // the chip bounces off and rolls away
      const bounce = chip.position.clone();
      const away = bounce.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 0, (Math.random() - 0.5) * 0.8)).setY(TABLE_Y + 0.01);
      flights.push({ obj: chip, from: bounce, to: away, t: 0, dur: 0.5, arc: 0.25, spin: 12, done: () => setTimeout(() => world.scene.remove(chip), 1500) });
    },
  });
}

function updateFlights(dt: number) {
  for (let i = flights.length - 1; i >= 0; i--) {
    const f = flights[i];
    f.t += dt;
    if (f.t < 0) continue;
    const p = Math.min(1, f.t / f.dur);
    const to = typeof f.to === "function" ? f.to() : f.to;
    f.obj.position.lerpVectors(f.from, to, p);
    f.obj.position.y += Math.sin(p * Math.PI) * f.arc;
    f.obj.rotation.x += f.spin * dt;
    if (p >= 1) {
      if (f.spin) f.obj.rotation.set(0, f.obj.rotation.y, 0);
      flights.splice(i, 1);
      f.done?.();
    }
  }
}

// ---------------- input ----------------

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();

type Hit = { kind: "avatar"; id: string } | { kind: "duck" } | { kind: "ticket" } | null;

function hitTest(x: number, y: number): Hit {
  ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, world.camera);
  const targets: THREE.Object3D[] = [...world.interactive];
  for (const [id, s] of seats) if (id !== me.id) targets.push(s.avatar.hitbox);
  const hit = raycaster.intersectObjects(targets, true)[0];
  if (!hit) return null;
  if (hit.object.userData.avatarId) return { kind: "avatar", id: hit.object.userData.avatarId };
  if (hit.object.userData.kind === "duck") return { kind: "duck" };
  if (hit.object.userData.kind === "ticket") return { kind: "ticket" };
  return null;
}

let lastFlick = 0;
function activate(hit: Hit) {
  if (!hit) return;
  if (hit.kind === "avatar") {
    if (performance.now() - lastFlick < 600) return;
    lastFlick = performance.now();
    net.send({ t: "flick", target: hit.id });
  } else if (hit.kind === "duck") { sfx.squeak(); world.hopDuck(); }
  else if (hit.kind === "ticket") hud.openSheet();
}

function setupInput() {
  const canvas = $<HTMLCanvasElement>("scene");
  let down: { x: number; y: number; id: number } | null = null;
  let dragging = false;
  canvas.addEventListener("pointerdown", (e) => {
    down = { x: e.clientX, y: e.clientY, id: e.pointerId };
    dragging = false;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (down && e.pointerId === down.id) {
      if (!dragging && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) dragging = true;
      if (dragging) {
        canvas.classList.add("dragging");
        view.yaw = THREE.MathUtils.clamp(view.yaw - e.movementX * 0.003, -1.9, 1.9);
        view.pitch = THREE.MathUtils.clamp(view.pitch - e.movementY * 0.00225, -0.55, 0.9);
      }
      return;
    }
    if (e.pointerType === "mouse") canvas.classList.toggle("pointing", !!hitTest(e.clientX, e.clientY));
  });
  canvas.addEventListener("pointerup", (e) => {
    canvas.classList.remove("dragging");
    if (down && !dragging) activate(hitTest(e.clientX, e.clientY));
    down = null;
  });
  canvas.addEventListener("dblclick", () => { view.yaw = 0; view.pitch = 0; });

  addEventListener("keydown", (e) => {
    if (!inGame || (e.target as HTMLElement).closest("input, textarea") || !$("lobby").hidden) return;
    const k = e.key.toLowerCase();
    if (EMOTE_KEYS[k]) { net.send({ t: "emote", kind: EMOTE_KEYS[k] }); return; }
    if (k === "r") { view.yaw = 0; view.pitch = 0; }
  });
}

// ---------------- mic → mouth flaps ----------------

const mic = new Mic();
function setupMic() {
  const btn = $("mic");
  const paint = () => {
    btn.classList.toggle("on", mic.on);
    btn.title = mic.on ? "Mic on: your mouth moves when you talk (no audio is sent). Click to turn off." : "Turn on mic: your character's mouth moves when you talk (no audio is sent)";
  };
  mic.onLevel = (level) => net.send({ t: "talk", level });
  mic.onMeter = (level) => btn.style.setProperty("--lvl", level.toFixed(2));
  const start = async () => {
    try {
      await mic.start();
      localStorage.setItem("pp-mic", "1");
    } catch {
      hud.toast("Couldn't use the mic. Check your browser's permission for this site.", "error");
      localStorage.removeItem("pp-mic");
    }
    paint();
  };
  btn.onclick = () => {
    if (mic.on) { mic.stop(); localStorage.removeItem("pp-mic"); paint(); }
    else start();
  };
  paint();
  if (localStorage.getItem("pp-mic")) start();
  else setTimeout(() => hud.toast("🎙️ Tip: turn on your mic (top right) and your bean's mouth moves when you talk. No audio is sent."), 4000);
}

// ---------------- per-frame ----------------

let lookTimer = 0;
function frame(dt: number, t: number) {
  camPos.lerp(camTarget, Math.min(1, dt * 3));
  world.camera.position.copy(camPos);
  const d = new THREE.Vector3(0, TABLE_Y + 0.1, 0).sub(camPos);
  baseYaw = Math.atan2(-d.x, -d.z);
  basePitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
  world.camera.rotation.set(basePitch - view.pitch, baseYaw - view.yaw, 0, "YXZ");

  lookTimer += dt;
  if (lookTimer > 0.1 && (Math.abs(view.yaw - view.sentYaw) > 0.01 || Math.abs(view.pitch - view.sentPitch) > 0.01)) {
    lookTimer = 0;
    view.sentYaw = view.yaw;
    view.sentPitch = view.pitch;
    net.send({ t: "look", yaw: -view.yaw, pitch: -view.pitch });
  }

  for (const s of seats.values()) {
    s.avatar.group.position.lerp(s.pos, Math.min(1, dt * 4));
    let dr = s.facing - s.avatar.group.rotation.y;
    dr = Math.atan2(Math.sin(dr), Math.cos(dr));
    s.avatar.group.rotation.y += dr * Math.min(1, dt * 4);
    s.avatar.update(dt, t);
    // idle fidget: now and then someone straightens their face-down card
    if (state?.phase === "voting" && s.card.group.visible && !s.card.isFaceUp && s.avatar.group.visible && !s.avatar.busyWithCard && Math.random() < dt / 11) {
      s.avatar.adjustCard();
      s.card.nudge(0.2);
    }
    s.card.update(dt);
  }
  updateFlights(dt);
  world.update(dt, t);
}

document.fonts.load("700 40px Fredoka").catch(() => {}).finally(() => void bootLobby());
