// Diner-only textures: the checkerboard floor, the cherry formica, the
// wallpaper's little boomerangs and the night outside the windows.
import * as THREE from "three";
import { canvasTex } from "../../scene/art/textures.ts";
import { speckle } from "../kit/canvas.ts";

export const RED = "#c8323c";
export const TEAL = "#4fb3a9";
export const CREAM = "#f3e3c3";
export const CHROME = "#dfe5e9";

/** Black and white tiles, two to a repeat, repeated `repeatX` by `repeatY` times. */
export function checkerTexture(repeatX: number, repeatY: number): THREE.CanvasTexture {
  const t = canvasTex(256, 256, (g) => {
    g.fillStyle = "#f4f1ea";
    g.fillRect(0, 0, 256, 256);
    g.fillStyle = "#1e1e22";
    g.fillRect(0, 0, 128, 128);
    g.fillRect(128, 128, 128, 128);
    // years of scuffs
    speckle(g, 500, 3, () => `rgba(80,70,60,${Math.random() * 0.12})`);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  return t;
}

/** Cherry-red formica with its pale swooshes and flecks, over a `size` square canvas. */
export function paintFormica(g: CanvasRenderingContext2D, size: number) {
  g.fillStyle = RED;
  g.fillRect(0, 0, size, size);
  const k = size / 1024;
  for (let i = 0; i < 70 * k * k + 12; i++) {
    const x = Math.random() * size,
      y = Math.random() * size,
      w = (18 + Math.random() * 24) * k;
    g.strokeStyle = Math.random() < 0.5 ? "rgba(255,140,150,0.55)" : "rgba(120,20,30,0.5)";
    g.lineWidth = 4 * k;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + w / 2, y - w * 0.6, x + w, y);
    g.stroke();
  }
  speckle(g, 1400 * k * k, 3 * k, () => (Math.random() < 0.6 ? "rgba(255,220,225,0.7)" : "rgba(90,10,20,0.6)"));
}

/** Formica for the counter and the booth tables. */
export function formicaTexture(size: number): THREE.CanvasTexture {
  const t = canvasTex(size, size, (g) => paintFormica(g, size));
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Cream wallpaper with little teal and red boomerangs. */
export function wallpaperTexture(): THREE.CanvasTexture {
  const t = canvasTex(256, 256, (g) => {
    g.fillStyle = CREAM;
    g.fillRect(0, 0, 256, 256);
    g.lineWidth = 5;
    g.lineCap = "round";
    for (let i = 0; i < 8; i++) {
      const x = (i % 4) * 64 + (Math.floor(i / 4) % 2) * 32 + 16,
        y = Math.floor(i / 4) * 128 + 50;
      g.strokeStyle = i % 3 ? "rgba(79,179,169,0.45)" : "rgba(200,50,60,0.35)";
      g.beginPath();
      g.moveTo(x - 12, y + 6);
      g.quadraticCurveTo(x, y - 14, x + 12, y + 6);
      g.stroke();
    }
    g.fillStyle = "rgba(60,40,20,0.25)";
    for (let i = 0; i < 10; i++) g.fillRect(Math.random() * 256, Math.random() * 256, 3, 3);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(8, 2);
  return t;
}

/** Night outside: deep blue, a few stars, a far-off streetlight smear. */
export function nightTexture(): THREE.CanvasTexture {
  return canvasTex(256, 256, (g) => {
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, "#0b1030");
    grad.addColorStop(1, "#2a2350");
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    g.fillStyle = "#fff6c8";
    for (let i = 0; i < 18; i++) g.fillRect(Math.random() * 256, Math.random() * 150, 2, 2);
    const lamp = g.createRadialGradient(190, 200, 2, 190, 200, 60);
    lamp.addColorStop(0, "rgba(255,200,120,0.6)");
    lamp.addColorStop(1, "rgba(255,200,120,0)");
    g.fillStyle = lamp;
    g.fillRect(0, 0, 256, 256);
  });
}
