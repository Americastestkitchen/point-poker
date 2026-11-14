// Your own body when you look down: torso, arms and hands, the classic FPS way. Your bean is
// hidden on your screen (everyone else sees it as usual); this draws a first-person body in its
// place instead, posed like your bean every frame. It's drawn in a pass of its own after the
// room, so your arms are always in front of the table and the cards, never through them. The
// room's lights light it, so it looks like it's in the room: each room hands its lights over
// with lightsYourBody as it goes up.
import * as THREE from "three";
import type { Store } from "../app/store.ts";
import type { Avatar } from "../avatar/avatar.ts";
import { createFirstPersonBody, type FirstPersonBody } from "../avatar/first-person.ts";
import type { Stage } from "./engine/stage.ts";

/** The layer only the first-person pass draws: the room's camera doesn't see it, and clicks go through it. */
const LAYER = 1;

export function mountFirstPerson(
  stage: Stage,
  deps: {
    store: Store;
    /** Your bean at the table, while you're sitting at one. */
    mine(): Avatar | null;
  },
) {
  const { scene, camera, renderer } = stage;
  let fp: { body: FirstPersonBody; look: Avatar["look"] } | null = null;

  stage.onFrame(() => {
    const avatar = deps.mine();
    // the title screens and the look editor show your bean on its turntable instead
    const shown = !!avatar && !deps.store.getState().showcase;
    if (fp) fp.body.group.visible = shown;
    if (!avatar || !shown) return;
    if (!fp) {
      fp = { body: createFirstPersonBody(avatar.look), look: avatar.look };
      scene.add(fp.body.group);
      onLayer(fp.body.group);
    } else if (fp.look !== avatar.look) {
      fp.body.setLook(avatar.look);
      fp.look = avatar.look;
      onLayer(fp.body.group);
    }
    // where your bean sits (it glides there like everyone's), just below and in front of your eyes
    fp.body.group.position.copy(avatar.group.position);
    fp.body.group.quaternion.copy(avatar.group.quaternion);
    // something new in your hand joins your body's layer
    if (fp.body.apply(avatar.pose)) onLayer(fp.body.group);
  });

  stage.afterRender(() => {
    if (!fp?.body.group.visible) return;
    const { background } = scene;
    const autoClear = renderer.autoClear;
    const shadows = renderer.shadowMap.autoUpdate;
    // over the room as drawn: no clearing to the background colour, no redrawing its shadows
    // with only your body in them, and nothing of the room in front of you
    scene.background = null;
    renderer.autoClear = false;
    renderer.shadowMap.autoUpdate = false;
    renderer.clearDepth();
    camera.layers.set(LAYER);
    renderer.render(scene, camera);
    camera.layers.set(0);
    renderer.shadowMap.autoUpdate = shadows;
    renderer.autoClear = autoClear;
    scene.background = background;
  });
}

/**
 * Lets the lights in `room` light your body as well as the room. Call it on each room as it goes
 * up: a room's lights are new every time, even when it's a room you've been in before, and
 * without them your body is drawn unlit, all black.
 */
export function lightsYourBody(room: THREE.Object3D) {
  room.traverse((o) => {
    if (o instanceof THREE.Light) o.layers.enable(LAYER);
  });
}

/** Puts `o` and everything in it on the first-person layer, casting no shadows. */
function onLayer(o: THREE.Object3D) {
  o.traverse((c) => {
    c.layers.set(LAYER);
    c.castShadow = false;
  });
}
