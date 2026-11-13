// The landing page and the character creator (plain DOM until #4 replaces it).
import { BODIES } from "../../shared/catalog/bodies.ts";
import { COLORS } from "../../shared/catalog/colors.ts";
import { COSMETICS } from "../../shared/catalog/cosmetics.ts";
import { randomLook, wornIn } from "../../shared/look.ts";
import { OpenedTable, TableInfo } from "../../shared/protocol.ts";
import type { Actions } from "./app/actions.ts";
import { editProfile, readyToSit, type ProfileAction } from "./app/profile.ts";
import type { Profile, Storage } from "./app/storage.ts";
import type { Store } from "./app/store.ts";
import type { Audio } from "./audio/sfx.ts";
import { createTurntable } from "./scene/turntable.ts";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** The hat row: going bare, then everything that sits on your head. */
const HATS = [{ id: null, label: "bare", icon: "🫥" }, ...COSMETICS.filter((c) => c.slots.includes("head"))];

export function mountLobby(deps: { store: Store; storage: Storage; audio: Audio; actions: Actions; roomCode: string; onSit(): void | Promise<void> }) {
  const { store, storage, audio, actions, roomCode } = deps;
  const dealerKey = roomCode ? storage.dealerKey(roomCode) : undefined;
  const saved = storage.profile();
  let me: Profile = { name: saved.name ?? "", look: saved.look ?? randomLook() };
  const edit = (a: ProfileAction) => { me = editProfile(me, a); };
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
    const opened = res.ok ? OpenedTable.safeParse(await res.json().catch(() => null)) : null;
    if (!opened?.success) return alert("Couldn't open a table, try again.");
    storage.setHostPass(pass);
    const { code, dealerKey } = opened.data;
    storage.setDealerKey(code, dealerKey);
    location.search = `?room=${code}`;
  }

  function showStart(message?: string) {
    store.startShown();
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
    const info = await fetch(`/api/rooms/${roomCode}`).then((r) => r.json()).then((j) => TableInfo.parse(j)).catch(() => null);
    if (!info?.exists) {
      history.replaceState(null, "", location.pathname);
      return showStart(`Table ${roomCode} isn't open anymore. Start a new one?`);
    }
    openCreator();
  }

  function refresh() {
    [...$("colors").children].forEach((b, i) => b.classList.toggle("on", COLORS[i] === me.look.color));
    [...$("hats").children].forEach((b, i) => b.classList.toggle("on", HATS[i].id === wornIn(me.look, "head")));
    [...$("bodies").children].forEach((b, i) => b.classList.toggle("on", BODIES[i].id === me.look.body));
    preview?.setLook(me.look);
    preview?.wave();
  }

  /** A row of buttons, one per choice. */
  function choices<T>(el: HTMLElement, list: readonly T[], current: (v: T) => boolean, paint: (b: HTMLButtonElement, v: T) => void, set: (v: T) => void) {
    el.innerHTML = "";
    for (const v of list) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = current(v) ? "on" : "";
      paint(b, v);
      b.onclick = () => { set(v); audio.pop(); refresh(); };
      el.append(b);
    }
  }
  const icon = (c: { icon: string; label: string }) => `${c.icon}<span>${c.label}</span>`;

  function openCreator() {
    const playing = inGame();
    if (playing) store.setUi({ lookOpen: true });
    else store.creatorOpened();
    $("lobby").hidden = false;
    $("start-view").hidden = true;
    $("creator-view").hidden = false;
    $("dealer-badge").hidden = !dealerKey;
    $("sit").textContent = playing ? "Done" : dealerKey ? "Open the table →" : "Join the table →";
    ($("look-more") as HTMLDetailsElement).open = playing;
    const nameIn = $<HTMLInputElement>("name-input");
    nameIn.value = me.name;
    nameIn.oninput = () => edit({ t: "name", name: nameIn.value });

    choices($("colors"), COLORS, (c) => c === me.look.color, (b, c) => (b.style.background = c), (color) => edit({ t: "color", color }));
    choices($("bodies"), BODIES, (b) => b.id === me.look.body, (el, b) => (el.innerHTML = icon(b)), (b) => edit({ t: "body", body: b.id }));
    choices($("hats"), HATS, (h) => h.id === wornIn(me.look, "head"), (b, h) => (b.innerHTML = icon(h)), (h) => edit({ t: "wear", slot: "head", id: h.id }));
    preview ??= createTurntable($<HTMLCanvasElement>("preview"), me.look, { dealer: !!dealerKey, visible: () => !$("lobby").hidden });
    preview.setLook(me.look);

    $("sit-form").onsubmit = (e) => {
      e.preventDefault();
      const ready = readyToSit(me);
      if (!ready) { nameIn.focus(); nameIn.classList.add("nudge"); setTimeout(() => nameIn.classList.remove("nudge"), 500); return; }
      me = ready;
      storage.setProfile(me);
      $("lobby").hidden = true;
      if (inGame()) {
        store.setUi({ lookOpen: false });
        actions.setLook(me.look);
      } else void deps.onSit();
    };
    setTimeout(() => nameIn.focus(), 50);
  }

  return { boot, openCreator, profile: () => me };
}
