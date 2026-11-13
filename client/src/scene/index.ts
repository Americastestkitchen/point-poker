// The 3D scene: the room, the table and everyone at it, read from the store.
import type { Actions } from "../app/actions.ts";
import type { Store } from "../app/store.ts";
import type { Audio } from "../audio/sfx.ts";
import { createCameraRig } from "./camera.ts";
import { createFlights } from "./flights.ts";
import { bindInput } from "./input.ts";
import type { Stage } from "./stage.ts";
import { mountTableView } from "./table-view.ts";
import { World } from "./world.ts";

export function mountScene(stage: Stage, deps: { store: Store; actions: Actions; audio: Audio }) {
  const { store, actions, audio } = deps;
  const world = new World(stage.scene, stage.picking, { onTicket: actions.openTicket, onSqueak: audio.squeak });
  const rig = createCameraRig(stage.camera, actions.gaze);
  const flights = createFlights();
  const table = mountTableView(stage, { store, actions, audio, world, flights, rig });
  bindInput(stage, { store, actions, rig });
  audio.ambience("basement");

  stage.onFrame((dt) => rig.update(dt));
  stage.onFrame((dt, t) => table.update(dt, t));
  stage.onFrame((dt) => flights.update(dt));
  stage.onFrame((dt, t) => world.update(dt, t));
}
