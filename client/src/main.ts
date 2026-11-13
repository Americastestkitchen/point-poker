// Entry point: the only file that touches browser globals. It builds the
// adapters and wires them together; everything else gets them passed in.
import { createActions } from "./app/actions.ts";
import { createSession } from "./app/session.ts";
import { createStorage } from "./app/storage.ts";
import { createStore } from "./app/store.ts";
import { Mic } from "./audio/mic.ts";
import { createAudio } from "./audio/sfx.ts";
import { Hud } from "./hud.ts";
import { mountLobby } from "./lobby.ts";
import { mountScene } from "./scene/index.ts";
import { createStage } from "./scene/stage.ts";
import "./style.css";

const $ = (id: string) => document.getElementById(id)!;

const roomCode = (new URLSearchParams(location.search).get("room") ?? "").toUpperCase();
const storage = createStorage(localStorage);
const audio = createAudio(storage);
const store = createStore();
const session = createSession({
  connect: (url) => new WebSocket(url),
  storage,
  store,
  url: `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`,
});
const actions = createActions(session, store);
const lobby = mountLobby({ store, storage, audio, actions, roomCode, onSit: startGame });

async function startGame() {
  store.setState({ screen: "table" });
  $("hud").hidden = false;
  $("wardrobe").style.setProperty("--me", lobby.me.look.color);
  const stage = createStage($("scene") as HTMLCanvasElement, { audio });
  new Hud({ store, actions, audio, storage, mic: new Mic(), openLook: lobby.openCreator });
  await mountScene(stage, { store, actions, audio });
  session.join(roomCode);
  stage.start();
}

document.fonts.load("700 40px Fredoka").catch(() => {}).finally(() => void lobby.boot());
