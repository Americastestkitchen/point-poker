// The landing page and the character creator (plain DOM until #4 replaces it).
import { BODIES, COLORS, HATS, type Body, type Hat } from "../../shared/protocol.ts";
import type { Actions } from "./app/actions.ts";
import type { Profile, Storage } from "./app/storage.ts";
import type { Store } from "./app/store.ts";
import type { Audio } from "./audio/sfx.ts";
import { createTurntable } from "./scene/turntable.ts";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];

const HAT_ICON: Record<Hat, [string, string]> = {
  none: ["🫥", "bare"], beanie: ["🧢", "propeller"], tophat: ["🎩", "top hat"], cone: ["🚧", "cone"],
  party: ["🥳", "party"], chef: ["🧑‍🍳", "chef"], horns: ["🪖", "viking"], fez: ["🔴", "fez"], crown: ["👑", "crown"],
};
const BODY_ICON: Record<Body, [string, string]> = {
  bean: ["🫘", "bean"], chonk: ["🍔", "chonk"], noodle: ["🍝", "noodle"], box: ["📦", "box"], pear: ["🍐", "pear"],
};

export function mountLobby(deps: { store: Store; storage: Storage; audio: Audio; actions: Actions; roomCode: string; onSit(): void }) {
  const { store, storage, audio, actions, roomCode } = deps;
  const dealerKey = roomCode ? storage.dealerKey(roomCode) : undefined;
  const saved = storage.profile();
  const look: Profile = {
    name: saved.name ?? "",
    color: saved.color ?? pick(COLORS),
    hat: saved.hat ?? pick(HATS.slice(1)),
    body: saved.body ?? pick(BODIES),
  };
  let preview: ReturnType<typeof createTurntable> | null = null;
  const inGame = () => store.getState().screen === "table";

  async function openTable() {
    const tryOpen = (pass: string) => fetch("/api/rooms", { method: "POST", headers: { "x-host-passcode": pass } });
    let pass = storage.hostPass();
    let res = await tryOpen(pass);
    while (res.status === 401) {
      const typed = prompt(pass ? "That passcode didn't work. Host passcode:" : "Host passcode (only needed to open a table):");
      if (typed === null) return;
      pass = typed.trim();
      res = await tryOpen(pass);
    }
    if (!res.ok) return alert("Couldn't open a table, try again.");
    storage.setHostPass(pass);
    const { code, dealerKey } = await res.json();
    storage.setDealerKey(code, dealerKey);
    location.search = `?room=${code}`;
  }

  function showStart(message?: string) {
    store.setState({ screen: "start" });
    $("start-view").hidden = false;
    $("creator-view").hidden = true;
    if (message) $("start-view").insertAdjacentHTML("afterbegin", `<div class="toast error">${esc(message)}</div>`);
    $("new-table").onclick = openTable;
    $("join-code").onsubmit = (e) => {
      e.preventDefault();
      const code = $<HTMLInputElement>("code-input").value.trim().toUpperCase();
      if (code) location.search = `?room=${code}`;
    };
  }

  async function boot() {
    if (!roomCode) return showStart();
    const res = await fetch(`/api/rooms/${roomCode}`).then((r) => r.json()).catch(() => ({ exists: false }));
    if (!res.exists) {
      history.replaceState(null, "", location.pathname);
      return showStart(`Table ${roomCode} isn't open anymore. Start a new one?`);
    }
    openCreator();
  }

  function refresh() {
    [...$("colors").children].forEach((b, i) => b.classList.toggle("on", COLORS[i] === look.color));
    [...$("hats").children].forEach((b, i) => b.classList.toggle("on", HATS[i] === look.hat));
    [...$("bodies").children].forEach((b, i) => b.classList.toggle("on", BODIES[i] === look.body));
    preview?.setLook(look);
    preview?.wave();
  }

  /** A row of buttons, one per choice. */
  function choices<T extends string>(el: HTMLElement, list: readonly T[], current: T, paint: (b: HTMLButtonElement, v: T) => void, set: (v: T) => void) {
    el.innerHTML = "";
    for (const v of list) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = v === current ? "on" : "";
      paint(b, v);
      b.onclick = () => { set(v); audio.pop(); refresh(); };
      el.append(b);
    }
  }
  const icon = ([emoji, label]: [string, string]) => `${emoji}<span>${label}</span>`;

  function openCreator() {
    const playing = inGame();
    if (playing) store.setUi({ lookOpen: true });
    else store.setState({ screen: "creator" });
    $("lobby").hidden = false;
    $("start-view").hidden = true;
    $("creator-view").hidden = false;
    $("dealer-badge").hidden = !dealerKey;
    $("sit").textContent = playing ? "Done" : dealerKey ? "Open the table →" : "Join the table →";
    ($("look-more") as HTMLDetailsElement).open = playing;
    const nameIn = $<HTMLInputElement>("name-input");
    nameIn.value = look.name;
    nameIn.oninput = () => (look.name = nameIn.value);

    choices($("colors"), COLORS, look.color, (b, c) => (b.style.background = c), (c) => (look.color = c));
    choices($("bodies"), BODIES, look.body, (b, v) => (b.innerHTML = icon(BODY_ICON[v])), (v) => (look.body = v));
    choices($("hats"), HATS, look.hat, (b, h) => (b.innerHTML = icon(HAT_ICON[h])), (h) => (look.hat = h));
    preview ??= createTurntable($<HTMLCanvasElement>("preview"), look, { dealer: !!dealerKey, visible: () => !$("lobby").hidden });
    preview.setLook(look);

    $("sit-form").onsubmit = (e) => {
      e.preventDefault();
      look.name = nameIn.value.trim() || look.name;
      if (!look.name) { nameIn.focus(); nameIn.classList.add("nudge"); setTimeout(() => nameIn.classList.remove("nudge"), 500); return; }
      storage.setProfile(look);
      $("lobby").hidden = true;
      if (inGame()) {
        store.setUi({ lookOpen: false });
        actions.restyle({ color: look.color, hat: look.hat, body: look.body });
      } else deps.onSit();
    };
    setTimeout(() => nameIn.focus(), 50);
  }

  return { boot, openCreator, look };
}
