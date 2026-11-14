// Canvas helpers rooms draw their textures with: grime and a screen that redraws.
import * as THREE from "three";
import { context2d } from "../../scene/art/textures.ts";

/** Scatters `count` little squares over the canvas: fuzz, grime, rust, sand. `color` is asked once per speck. */
export function speckle(
  g: CanvasRenderingContext2D,
  count: number,
  size: number,
  color: () => string,
  area = { width: g.canvas.width, height: g.canvas.height },
) {
  for (let i = 0; i < count; i++) {
    g.fillStyle = color();
    g.fillRect(Math.random() * area.width, Math.random() * area.height, size, size);
  }
}

/** A texture to draw on again and again (a screen, a board). Call `redraw` after drawing on `g`. */
export function liveCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return {
    texture,
    g: context2d(canvas),
    redraw() {
      texture.needsUpdate = true;
    },
  };
}
