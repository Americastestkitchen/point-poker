// Browser composition root: builds adapters and wires app, world, game screens and the
// legacy lobby (#4). The game UI is one mountUi() call; the world gets its keyboard gate
// from it. Browser APIs also live in rendering, input, audio and DOM UI modules.
import { createActions } from "./app/actions.ts";
import { createSession } from "./app/session.ts";
import { createStorage } from "./app/storage.ts";
import { createStore } from "./app/store.ts";
import { createMic } from "./audio/mic.ts";
import { createAudio } from "./audio/sfx.ts";
import { mountLobby } from "./lobby.ts";
import { mountScene } from "./scene/index.ts";
import { createStage } from "./scene/engine/stage.ts";
import { createGameUi } from "./screens/index.tsx";
import { createToasts, mountUi } from "./ui/index.ts";
import "./style.css";

const $ = (id: string) => document.getElementById(id)!;

const roomCode = (new URLSearchParams(location.search).get("room") ?? "").toUpperCase();
const storage = createStorage(localStorage);
const audio = createAudio(storage);
const store = createStore();
const toasts = createToasts();
const session = createSession({
  connect: (url) => new WebSocket(url),
  storage,
  store,
  url: `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`,
});
const actions = createActions(session, store);
const lobby = mountLobby({ store, storage, audio, actions, roomCode, onSit: startGame });

async function startGame() {
  store.seated();
  const stage = createStage($("scene") as HTMLCanvasElement, { audio });
  const game = createGameUi({
    store,
    actions,
    storage,
    audio,
    toasts,
    mic: createMic(),
    openLook: lobby.openCreator,
    leaveTable: () => location.assign(location.pathname),
    inviteUrl: () => {
      const c = store.getState().connection;
      return `${location.origin}${location.pathname}?room=${c.status === "idle" ? "" : c.room}`;
    },
  });
  const unmountUi = mountUi($("ui"), game.ui, { sounds: audio, toasts });
  // the UI lives as long as the page: let go of the mic when it's really gone (not bfcached)
  addEventListener("pagehide", (e) => {
    if (e.persisted) return;
    unmountUi();
    game.dispose();
  });
  await mountScene(stage, { store, actions, audio, allowsWorldKeys: game.allowsWorldKeys });
  session.join(roomCode);
  stage.start();
}

document.fonts
  .load("700 40px Fredoka")
  .catch(() => {})
  .finally(() => void lobby.boot());
