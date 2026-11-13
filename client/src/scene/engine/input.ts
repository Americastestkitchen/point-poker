// Pointer and keyboard on the 3D scene: drag to look, click to pick, keys to emote.
import { EMOTES } from "../../../../shared/catalog/emotes.ts";
import type { Actions } from "../../app/actions.ts";
import type { Store } from "../../app/store.ts";
import type { CameraRig } from "./camera.ts";
import type { Stage } from "./stage.ts";

/** What the pointer is doing on the canvas. */
type Pointer =
  | { state: "idle" }
  /** Pressed and hardly moved: letting go here is a click. */
  | { state: "pressed"; id: number; x: number; y: number }
  /** Moved far enough to be a drag: it turns your head, and letting go clicks nothing. */
  | { state: "dragging"; id: number };

/** How far (CSS px) a press can wander and still be a click. */
const CLICK_SLOP = 6;

export function bindInput(stage: Stage, deps: { store: Store; actions: Actions; rig: CameraRig }) {
  const { store, actions, rig } = deps;
  const canvas = stage.canvas;
  let pointer: Pointer = { state: "idle" };

  canvas.addEventListener("pointerdown", (e) => {
    pointer = { state: "pressed", id: e.pointerId, x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (pointer.state !== "idle" && e.pointerId === pointer.id) {
      if (pointer.state === "pressed" && Math.hypot(e.clientX - pointer.x, e.clientY - pointer.y) > CLICK_SLOP) {
        pointer = { state: "dragging", id: pointer.id };
      }
      if (pointer.state === "dragging") {
        canvas.classList.add("dragging");
        rig.drag(e.movementX, e.movementY);
      }
      return;
    }
    if (e.pointerType === "mouse") canvas.classList.toggle("pointing", !!stage.picking.hit(e.clientX, e.clientY));
  });
  canvas.addEventListener("pointerup", (e) => {
    canvas.classList.remove("dragging");
    if (pointer.state === "pressed") stage.picking.hit(e.clientX, e.clientY)?.();
    pointer = { state: "idle" };
  });
  // the browser took the pointer back (a scroll gesture, an alert): no click, no drag
  canvas.addEventListener("pointercancel", () => {
    canvas.classList.remove("dragging");
    pointer = { state: "idle" };
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
