// The 3D scene: the room, the table and everyone at it, read from the store, your own body when
// you look down, and your bean on show for the title screens and the look editor. Until you sit
// down the camera drifts round the room behind the title screens.
import type { Actions } from "../app/actions.ts";
import type { Store } from "../app/store.ts";
import type { Audio } from "../audio/sfx.ts";
import { loadEnvironment } from "../environments/index.ts";
import { createCameraRig } from "./engine/camera.ts";
import { bindInput } from "./engine/input.ts";
import { mountFirstPerson } from "./first-person.ts";
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
  // The Basement for now; switching on settings.environment comes with #10.
  const env = await (await loadEnvironment("basement")).build({ layout, audio });
  stage.scene.background = env.background;
  stage.scene.fog = env.fog;
  stage.scene.add(env.root, buildTable(layout, env.tableMaterials));

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
    screen: env.props.statusScreen,
  });
  const { squeaky } = env.props;
  stage.picking.register(squeaky.object, () => {
    squeaky.squeak();
    table.mine()?.play("poke");
  });
  bindInput(stage, { actions, rig, allowsWorldKeys: deps.allowsWorldKeys });
  audio.ambience(env.ambience);

  stage.onFrame((dt) => rig.update(dt));
  stage.onFrame((dt, t) => table.update(dt, t));
  // after the table, so your body copies the pose your bean has this frame
  mountFirstPerson(stage, { store, mine: table.mine });
  stage.onFrame((dt) => flights.update(dt));
  stage.onFrame((dt, t) => env.update(dt, t));
}
