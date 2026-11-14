// Pointer and keyboard on the 3D scene: drag to look, click to pick, keys to emote, and the
// number keys or the scroll wheel to change the hand item a click uses.
import { EMOTES } from "../../../../shared/catalog/emotes.ts";
import { ITEMS } from "../../../../shared/catalog/items.ts";
import type { Actions } from "../../app/actions.ts";
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
/**
 * How much scrolling (CSS px of wheel delta) moves the hotbar one item along, and how long a
 * pause (ms) forgets a scroll that didn't get that far. A mouse wheel's notch is about 100;
 * a trackpad sends many small ones.
 */
const WHEEL_STEP = 60,
  WHEEL_FORGETS_MS = 250;

export interface InputDeps {
  actions: Actions;
  rig: CameraRig;
  /**
   * Whether the world may take a key press: the UI injects it, and says no while it has the
   * keyboard (a popup, the look editor, a focused button or field).
   */
  allowsWorldKeys(): boolean;
}

export function bindInput(stage: Stage, deps: InputDeps) {
  const { actions, rig, allowsWorldKeys } = deps;
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

  // the scroll wheel over the room walks the hotbar
  let scrolled = 0,
    scrolledAt = 0;
  canvas.addEventListener(
    "wheel",
    (e) => {
      if (e.ctrlKey) return; // a pinch to zoom the page
      if (e.timeStamp - scrolledAt > WHEEL_FORGETS_MS) scrolled = 0;
      scrolledAt = e.timeStamp;
      // lines and pages count as a notch each
      scrolled += e.deltaMode === WheelEvent.DOM_DELTA_PIXEL ? e.deltaY : Math.sign(e.deltaY) * WHEEL_STEP;
      const steps = Math.trunc(scrolled / WHEEL_STEP);
      if (!steps) return;
      scrolled -= steps * WHEEL_STEP;
      actions.items.cycle(Math.sign(steps));
    },
    { passive: true },
  );

  addEventListener("keydown", (e) => {
    // something else used this key already (Esc closing a popup), or the UI has the keyboard
    if (e.defaultPrevented || !allowsWorldKeys()) return;
    const k = e.key.toLowerCase();
    const emote = EMOTES.find((x) => x.key === k);
    if (emote) {
      actions.emote(emote.id);
      return;
    }
    const item = ITEMS.find((x) => x.key === k);
    if (item) {
      actions.items.pick(item.id);
      return;
    }
    if (k === "r") rig.recenter();
  });
}
