// The 3D scene: the room, the table and everyone at it, read from the store.
import * as THREE from "three";
import type { Actions } from "../app/actions.ts";
import type { Store } from "../app/store.ts";
import type { Audio } from "../audio/sfx.ts";
import { loadEnvironment } from "../environments/index.ts";
import { createCameraRig } from "./camera.ts";
import { createFlights } from "./flights.ts";
import { bindInput } from "./input.ts";
import { layout } from "./layout.ts";
import type { Stage } from "./stage.ts";
import { TicketPaper, buildTable } from "./table.ts";
import { mountTableView } from "./table-view.ts";

export async function mountScene(stage: Stage, deps: { store: Store; actions: Actions; audio: Audio }) {
  const { store, actions, audio } = deps;
  // The Basement for now; switching on settings.environment comes with #10.
  const env = await (await loadEnvironment("basement")).build({ layout, audio, picking: stage.picking });
  stage.scene.background = env.background;
  stage.scene.fog = env.fog;
  stage.scene.add(env.root, buildTable(layout, env.tableMaterials));

  const ticket = new TicketPaper(layout);
  stage.picking.register(ticket.mesh, actions.openTicket);
  const pot = new THREE.Group();
  const p = layout.anchors.pot.position;
  pot.position.set(p.x, p.y, p.z);
  stage.scene.add(ticket.mesh, pot);

  const rig = createCameraRig(stage.camera, actions.gaze);
  const flights = createFlights();
  const table = mountTableView(stage, { store, actions, audio, flights, rig, ticket, pot, screen: env.props.statusScreen });
  bindInput(stage, { store, actions, rig });
  audio.ambience(env.ambience);

  stage.onFrame((dt) => rig.update(dt));
  stage.onFrame((dt, t) => table.update(dt, t));
  stage.onFrame((dt) => flights.update(dt));
  stage.onFrame((dt, t) => env.update(dt, t));
}
