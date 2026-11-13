// The 3D scene: the room, the table and everyone at it, read from the store.
import type { Actions } from "../app/actions.ts";
import type { Store } from "../app/store.ts";
import type { Audio } from "../audio/sfx.ts";
import { loadEnvironment } from "../environments/index.ts";
import { createCameraRig } from "./engine/camera.ts";
import { bindInput } from "./engine/input.ts";
import type { Stage } from "./engine/stage.ts";
import { layout } from "./layout/layout.ts";
import { createFlights } from "./table/flights.ts";
import { buildTable } from "./table/furniture.ts";
import { createPot } from "./table/pot.ts";
import { mountTableView } from "./table/table-view.ts";
import { createTicketPaper } from "./table/ticket.ts";

export async function mountScene(stage: Stage, deps: { store: Store; actions: Actions; audio: Audio }) {
  const { store, actions, audio } = deps;
  // The Basement for now; switching on settings.environment comes with #10.
  const env = await (await loadEnvironment("basement")).build({ layout, audio, picking: stage.picking });
  stage.scene.background = env.background;
  stage.scene.fog = env.fog;
  stage.scene.add(env.root, buildTable(layout, env.tableMaterials));

  const ticket = createTicketPaper(layout);
  stage.picking.register(ticket.mesh, actions.openTicket);
  stage.scene.add(ticket.mesh);
  const flights = createFlights();
  const pot = createPot(stage, { flights, audio });

  const rig = createCameraRig(stage.camera, actions.gaze);
  const table = mountTableView(stage, { store, actions, audio, flights, rig, ticket, pot, screen: env.props.statusScreen });
  bindInput(stage, { store, actions, rig });
  audio.ambience(env.ambience);

  stage.onFrame((dt) => rig.update(dt));
  stage.onFrame((dt, t) => table.update(dt, t));
  stage.onFrame((dt) => flights.update(dt));
  stage.onFrame((dt, t) => env.update(dt, t));
}
