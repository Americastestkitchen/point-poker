// Browser composition root: builds adapters and wires app, world and game screens. The 3D
// stage and the one game UI start straight away: the title screens play over the drifting
// room, and sitting down joins the table. The world gets its keyboard gate from the UI.
// Browser APIs also live in rendering, input, audio and DOM UI modules.
import { createActions } from "./app/actions.ts";
import { createSession } from "./app/session.ts";
import { createSit } from "./app/sit.ts";
import { createStorage } from "./app/storage.ts";
import { createStore } from "./app/store.ts";
import { createTables } from "./app/tables.ts";
import { createMic } from "./audio/mic.ts";
import { createAudio } from "./audio/sfx.ts";
import { mountScene } from "./scene/index.ts";
import { createStage } from "./scene/engine/stage.ts";
import { createGameUi } from "./screens/index.tsx";
import type { SignedIn } from "./screens/title/flow.ts";
import { createToasts, mountUi } from "./ui/index.ts";
import "./style.css";

/** The page's element with this id, checked to be the kind index.html promises. */
function $<T extends HTMLElement>(id: string, kind: new () => T): T {
  const el = document.getElementById(id);
  if (!(el instanceof kind)) throw new Error(`The page has no ${kind.name} #${id}`);
  return el;
}

const invite = (new URLSearchParams(location.search).get("room") ?? "").toUpperCase();

/** Back from signing in with Jira (`?host=1`, or `?host=failed`): read it once and tidy the address. */
function takeSignIn(): SignedIn {
  const url = new URL(location.href);
  const host = url.searchParams.get("host");
  if (host === null) return null;
  url.searchParams.delete("host");
  history.replaceState(null, "", url);
  return host === "1" ? "ok" : "failed";
}

/** Puts `?room=CODE` in the address bar, or takes it out (null), leaving any other parameters. */
function setRoomParam(code: string | null) {
  const url = new URL(location.href);
  if (code) url.searchParams.set("room", code);
  else if (url.searchParams.has("room")) url.searchParams.delete("room");
  else return;
  history.replaceState(null, "", url);
}
const storage = createStorage(localStorage);
const audio = createAudio(storage);
const store = createStore();
const toasts = createToasts();
const session = createSession({
  connect: (url) => new WebSocket(url),
  storage,
  store,
  log: console,
  url: `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`,
});
const actions = createActions(session, store);
const tables = createTables({ fetch: (url, init) => fetch(url, init), storage });
const stage = createStage($("scene", HTMLCanvasElement), { audio });

const game = createGameUi({
  store,
  actions,
  storage,
  audio,
  toasts,
  mic: createMic(),
  title: {
    inviteCode: invite,
    signedIn: takeSignIn(),
    tables,
    signIn: () => location.assign("/auth/jira/start"),
    sit: createSit({ store, session, showInvite: setRoomParam }),
    forgetInvite: () => setRoomParam(null),
  },
  leaveTable: () => location.assign(location.pathname),
  inviteUrl: () => {
    const c = store.getState().connection;
    return `${location.origin}${location.pathname}?room=${c.status === "idle" ? "" : c.room}`;
  },
});
const unmountUi = mountUi($("ui", HTMLElement), game.ui, { sounds: audio, toasts });
// the UI lives as long as the page: let go of the mic when it's really gone (not bfcached)
addEventListener("pagehide", (e) => {
  if (e.persisted) return;
  unmountUi();
  game.dispose();
});

stage.start();
// The room bakes its words (the sign, the whiteboard, name tags) into canvas textures once, so it
// waits for Fredoka; the UI doesn't (CSS swaps the font in by itself). If it never loads, go anyway.
Promise.all([document.fonts.load("700 40px Fredoka"), document.fonts.load("400 30px Fredoka")])
  .catch(() => {})
  .then(() => mountScene(stage, { store, actions, audio, allowsWorldKeys: game.allowsWorldKeys }))
  .catch((e: unknown) => {
    reportError(e); // the browser's console and error reporting see it, as if it were uncaught
    toasts.show("The room didn't load. Reload the page to try again.", { tone: "error" });
  });
