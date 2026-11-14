// The status screen's job, whatever it looks like: keep the ticket and the
// round's progress, and redraw when they change. A room's screen is a canvas
// size and a paint function (a telly, a chalkboard, a departure board).
import type { StatusScreen } from "../types.ts";
import { liveCanvas } from "./canvas.ts";
import type * as THREE from "three";

/** The ticket's key, its summary and how the round is going. */
export interface StatusLines {
  title: string;
  subtitle: string;
  status: string;
}

/** Paints the lines; `noise` is 0, or a little random interference for a frame. */
export type PaintStatus = (g: CanvasRenderingContext2D, lines: StatusLines, noise: number) => void;

/** A canvas showing the status lines. Put `texture` on the room's screen and wrap `object` round it. */
export function statusCanvas(width: number, height: number, paint: PaintStatus) {
  const { texture, g, redraw } = liveCanvas(width, height);
  let lines: StatusLines = { title: "NO TICKET", subtitle: "waiting on the dealer", status: "" };
  const draw = (noise = 0) => {
    paint(g, lines, noise);
    redraw();
  };
  draw();
  return {
    texture,
    /** Redraws with `noise` (a flicker), keeping the lines. */
    draw,
    screen(object: THREE.Object3D): StatusScreen {
      return {
        object,
        show(title, subtitle, status) {
          lines = { title, subtitle, status };
          draw();
        },
      };
    },
  };
}
