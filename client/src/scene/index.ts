// The 3D scene: the room, the table and everyone at it, read from the store, your own body when
// you look down, and your bean on show for the title screens and the look editor. Until you sit
// down the camera drifts round the room behind the title screens.
import type { Actions } from "../app/actions.ts";
import type { Store } from "../app/store.ts";
import type { Audio } from "../audio/sfx.ts";
import { loadEnvironment } from "../environments/index.ts";
import { DEFAULT_ENVIRONMENT, ENVIRONMENT } from "../../../shared/catalog/environments.ts";
import { createCurtain } from "./engine/curtain.ts";
import { DEFAULT_EXPOSURE } from "./engine/stage.ts";
import { createRoom } from "./room.ts";
import { createCameraRig } from "./engine/camera.ts";
import { bindInput } from "./engine/input.ts";
import { lightsYourBody, mountFirstPerson } from "./first-person.ts";
import type { Stage } from "./engine/stage.ts";
import { layout } from "./layout/layout.ts";
import { createFlights } from "./table/flights.ts";
import { mountShowcase } from "./showcase.ts";
import { buildTable } from "./table/furniture.ts";
import { createPot } from "./table/pot.ts";
import { mountTableView } from "./table/table-view.ts";
import { createTicketPaper } from "./table/ticket.ts";

export interface SceneDeps {
  store: Store;
  actions: Actions;
  audio: Audio;
  /** The UI's keyboard gate (see screens/keys.ts): world shortcuts only when it says yes. */
  allowsWorldKeys(): boolean;
}

export async function mountScene(stage: Stage, deps: SceneDeps) {
  const { store, actions, audio } = deps;
  mountShowcase(stage, store);
  const furniture = buildTable(layout);
  stage.scene.add(furniture.object);
  const room = createRoom({
    load: loadEnvironment,
    mount: {
      anchors: layout.anchors,
      sound: audio.room,
      pick: stage.picking.register,
      onFrame: stage.onFrame,
      // you clicked the squeaky: your bean reaches out and pokes it, and everyone else hears it
      squeaked: () => {
        table.mine()?.play("poke");
        actions.squeak();
      },
    },
    stage: {
      add: (o) => {
        lightsYourBody(o);
        stage.scene.add(o);
      },
      remove: (o) => stage.scene.remove(o),
      look({ background, fog, exposure }) {
        stage.scene.background = background;
        stage.scene.fog = fog;
        stage.renderer.toneMappingExposure = exposure ?? DEFAULT_EXPOSURE;
      },
    },
    table: furniture,
    curtain: createCurtain(stage),
    failed(id, error) {
      reportError(error);
      store.events.emit({
        t: "toast",
        text: `🧳 ${ENVIRONMENT[id].name} didn't load. Reload the page to try again.`,
        level: "error",
      });
    },
  });
  // The title screens are in the default room; at a table, you're wherever the table is.
  // Follow the table before the first room has loaded: the UI is already up, and someone who
  // sits down meanwhile must end up in the table's room, not this one (the latest move wins).
  const roomOf = (s: ReturnType<Store["getState"]>) => s.room?.environment ?? DEFAULT_ENVIRONMENT;
  store.subscribe((s, prev) => {
    if (s.room?.environment !== prev.room?.environment) void room.show(roomOf(s));
  });
  store.events.on((e) => {
    if (e.t === "fx" && e.fx.kind === "squeak") room.squeak();
  });
  await room.show(roomOf(store.getState()));

  const ticket = createTicketPaper(layout);
  stage.picking.register(ticket.mesh, actions.openTicket);
  stage.scene.add(ticket.mesh);
  const flights = createFlights();
  const pot = createPot(stage, { layout, flights, audio });

  const rig = createCameraRig(stage.camera, layout, actions.gaze);
  const table = mountTableView(stage, {
    store,
    actions,
    audio,
    layout,
    flights,
    rig,
    ticket,
    pot,
    screen: room.screen,
  });
  bindInput(stage, { actions, rig, allowsWorldKeys: deps.allowsWorldKeys });

  stage.onFrame((dt) => rig.update(dt));
  stage.onFrame((dt, t) => table.update(dt, t));
  // after the table, so your body copies the pose your bean has this frame
  mountFirstPerson(stage, { store, mine: table.mine });
  stage.onFrame((dt) => flights.update(dt));
}
