// Canvas helpers rooms draw their textures with: grime, lettering, and a screen that redraws.
import * as THREE from "three";
import { FONT, context2d } from "../../scene/art/textures.ts";

/** Scatters `count` little squares over the canvas: fuzz, grime, rust, sand. `color` is asked once per speck. */
export function speckle(g: CanvasRenderingContext2D, count: number, size: number, color: () => string) {
  const { width, height } = g.canvas;
  for (let i = 0; i < count; i++) {
    g.fillStyle = color();
    g.fillRect(Math.random() * width, Math.random() * height, size, size);
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

/** Writes `lines` one under another from (x, y), `step` pixels apart, in the canvas's current font and fill. */
export function textLines(g: CanvasRenderingContext2D, lines: readonly string[], x: number, y: number, step: number) {
  lines.forEach((line, i) => g.fillText(line, x, y + i * step));
}

/** A block of lines, each its own size and colour, centred on the canvas (a sign, a note). */
export function lettering(
  g: CanvasRenderingContext2D,
  lines: readonly (readonly [text: string, size: number, color: string])[],
) {
  const { width, height } = g.canvas;
  const total = lines.reduce((sum, [, size]) => sum + size * 1.25, 0);
  let y = (height - total) / 2;
  g.textAlign = "center";
  g.textBaseline = "top";
  for (const [text, size, color] of lines) {
    g.font = `bold ${size}px ${FONT}`;
    g.fillStyle = color;
    g.fillText(text, width / 2, y, width - 20);
    y += size * 1.25;
  }
}
