// Pop-ups for easter eggs: a note or a speech bubble that appears over something,
// rises and fades. Rooms show what a click did with them (no UI toasts in the world).
import * as THREE from "three";
import { FONT } from "../../scene/art/textures.ts";
import { plane, put } from "./build.ts";
import { liveCanvas } from "./canvas.ts";

export interface PopupOptions {
  /** Size, in metres. */
  width: number;
  height: number;
  /** Where it appears, in its parent's frame (up and out from it). */
  y: number;
  z?: number;
  /** How long it stays up, fading in and out within that. */
  seconds: number;
  fadeIn: number;
  fadeOut: number;
  /** How far it drifts up while it's showing. */
  rise?: number;
}

/**
 * Something that pops up over a thing for a few seconds and fades: a speech
 * bubble, a note. `show` starts it again; call `update` every frame (it says
 * whether it's up, so a room can turn it to face someone).
 */
export function popup(parent: THREE.Object3D, map: THREE.Texture, o: PopupOptions) {
  const mat = new THREE.MeshBasicMaterial({ map, transparent: true, opacity: 0, depthWrite: false });
  const mesh = put(plane(o.width, o.height, mat), 0, o.y, o.z ?? 0);
  mesh.visible = false;
  parent.add(mesh);
  let life = 0; // 1 → 0 while it's up
  return {
    mesh,
    show() {
      life = 1;
      mesh.visible = true;
    },
    update(dt: number): boolean {
      if (life <= 0) return false;
      life = Math.max(0, life - dt / o.seconds);
      mesh.position.y = o.y + (1 - life) * (o.rise ?? 0);
      mat.opacity = Math.min(1, (life * o.seconds) / o.fadeOut, ((1 - life) * o.seconds) / o.fadeIn);
      if (life === 0) mesh.visible = false;
      return life > 0;
    },
  };
}

/** A little speech bubble that pops up over something, says its line, rises and fades. */
export function bubble(parent: THREE.Object3D, width: number, y: number) {
  const W = 512,
    H = 128;
  const c = liveCanvas(W, H);
  const up = popup(parent, c.texture, {
    width,
    height: (width * H) / W,
    y,
    z: 0.12,
    seconds: 2.2,
    fadeIn: 2.2 / 12,
    fadeOut: 2.2 / 5,
    rise: 0.18,
  });
  up.mesh.renderOrder = 2;
  return {
    say(text: string, ink = "#c8323c") {
      const g = c.g;
      g.clearRect(0, 0, W, H);
      g.fillStyle = "#fffdf4";
      g.strokeStyle = ink;
      g.lineWidth = 8;
      g.beginPath();
      g.roundRect(8, 8, W - 16, H - 34, 40);
      g.fill();
      g.stroke();
      g.beginPath();
      g.moveTo(W / 2 - 18, H - 30);
      g.lineTo(W / 2, H - 4);
      g.lineTo(W / 2 + 18, H - 30);
      g.fill();
      g.fillStyle = ink;
      g.font = `bold 58px ${FONT}`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(text, W / 2, (H - 26) / 2 + 4, W - 60);
      c.redraw();
      up.show();
    },
    update: (dt: number) => void up.update(dt),
  };
}
