// Pointer and keyboard on the 3D scene: drag to look, click to pick, keys to emote.
import { EMOTES } from "../../../../shared/catalog/emotes.ts";
import type { Actions } from "../../app/actions.ts";
import type { Store } from "../../app/store.ts";
import type { CameraRig } from "./camera.ts";
import type { Stage } from "./stage.ts";


export function bindInput(stage: Stage, deps: { store: Store; actions: Actions; rig: CameraRig }) {
  const { store, actions, rig } = deps;
  const canvas = stage.canvas;
  let down: { x: number; y: number; id: number } | null = null;
  let dragging = false;

  canvas.addEventListener("pointerdown", (e) => {
    down = { x: e.clientX, y: e.clientY, id: e.pointerId };
    dragging = false;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (down && e.pointerId === down.id) {
      if (!dragging && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) dragging = true;
      if (dragging) {
        canvas.classList.add("dragging");
        rig.drag(e.movementX, e.movementY);
      }
      return;
    }
    if (e.pointerType === "mouse") canvas.classList.toggle("pointing", !!stage.picking.hit(e.clientX, e.clientY));
  });
  canvas.addEventListener("pointerup", (e) => {
    canvas.classList.remove("dragging");
    if (down && !dragging) stage.picking.hit(e.clientX, e.clientY)?.();
    down = null;
  });
  canvas.addEventListener("dblclick", () => rig.recenter());

  addEventListener("keydown", (e) => {
    const { screen, ui } = store.getState();
    if (screen !== "table" || ui.lookOpen || (e.target as HTMLElement).closest("input, textarea")) return;
    const k = e.key.toLowerCase();
    const emote = EMOTES.find((x) => x.key === k);
    if (emote) { actions.emote(emote.id); return; }
    if (k === "r") rig.recenter();
  });
}
