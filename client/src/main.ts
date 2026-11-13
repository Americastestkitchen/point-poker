// Browser composition root: builds adapters and wires app, world and game screens. The 3D
// stage and the one game UI start straight away: the title screens play over the drifting
// room, and sitting down joins the table. The world gets its keyboard gate from the UI.
// Browser APIs also live in rendering, input, audio and DOM UI modules.
import { createActions } from "./app/actions.ts";
import { createSession } from "./app/session.ts";
import { createStorage } from "./app/storage.ts";
import { createStore } from "./app/store.ts";
import { createTables } from "./app/tables.ts";
import { createMic } from "./audio/mic.ts";
import { createAudio } from "./audio/sfx.ts";
import { mountScene } from "./scene/index.ts";
import { createStage } from "./scene/engine/stage.ts";
import { createGameUi } from "./screens/index.tsx";
import { createToasts, mountUi } from "./ui/index.ts";
import "./style.css";

/** The page's element with this id, checked to be the kind index.html promises. */
function $<T extends HTMLElement>(id: string, kind: new () => T): T {
  const el = document.getElementById(id);
  if (!(el instanceof kind)) throw new Error(`The page has no ${kind.name} #${id}`);
  return el;
}

const invite = (new URLSearchParams(location.search).get("room") ?? "").toUpperCase();
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
    invite,
    tables,
    sit(code) {
      // the address becomes this table's invite link, so a reload puts you back in your seat
      history.replaceState(null, "", `${location.pathname}?room=${code}`);
      store.seated();
      session.join(code);
    },
    forgetInvite() {
      if (location.search) history.replaceState(null, "", location.pathname);
    },
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
void mountScene(stage, { store, actions, audio, allowsWorldKeys: game.allowsWorldKeys });
