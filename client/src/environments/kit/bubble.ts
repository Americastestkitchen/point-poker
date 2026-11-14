// A speech bubble for easter eggs: it pops up over something, says its line,
// rises and fades. Rooms show what a click did with it (no UI toasts in the world).
import * as THREE from "three";
import { FONT } from "../../scene/art/textures.ts";
import { liveCanvas } from "./canvas.ts";

/** A little speech bubble that pops up over something, rises and fades. */
export function bubble(parent: THREE.Object3D, width: number, y: number) {
  const W = 512,
    H = 128;
  const c = liveCanvas(W, H);
  const mat = new THREE.MeshBasicMaterial({ map: c.texture, transparent: true, opacity: 0, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, (width * H) / W), mat);
  mesh.position.set(0, y, 0.12);
  mesh.visible = false;
  mesh.renderOrder = 2;
  parent.add(mesh);
  let life = 0;
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
      life = 1;
      mesh.visible = true;
    },
    update(dt: number) {
      if (life <= 0) return;
      life = Math.max(0, life - dt / 2.2);
      mesh.position.y = y + (1 - life) * 0.18;
      mat.opacity = Math.min(1, life * 5, (1 - life) * 12);
      if (life === 0) mesh.visible = false;
    },
  };
}
