// Async Atoll's textures: sand, the sunset sky, the beach-towel felt, the
// umbrella's stripes and the surf shack's painted planks.
import * as THREE from "three";
import { FONT, canvasTex } from "../../scene/art/textures.ts";
import { speckle } from "../kit/canvas.ts";

export function sandTexture(): THREE.CanvasTexture {
  const t = canvasTex(256, 256, (g) => {
    g.fillStyle = "#e9c792";
    g.fillRect(0, 0, 256, 256);
    speckle(g, 2500, 2, () => (Math.random() < 0.5 ? "rgba(150,110,60,0.25)" : "rgba(255,245,220,0.35)"));
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(40, 40);
  return t;
}

/** Deep blue overhead to a peachy glow at the horizon; v runs bottom (0) to top (1) on the sky dome. */
export function skyTexture(): THREE.CanvasTexture {
  return canvasTex(8, 512, (g) => {
    const grad = g.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, "#2a2f6b");
    grad.addColorStop(0.32, "#7b4f9a");
    grad.addColorStop(0.46, "#f08a7a");
    grad.addColorStop(0.5, "#ffc38a");
    grad.addColorStop(0.53, "#f6a77a");
    grad.addColorStop(1, "#f6a77a");
    g.fillStyle = grad;
    g.fillRect(0, 0, 8, 512);
  });
}

/** A soft round glow, for the sun. */
export function glowTexture(color: string): THREE.CanvasTexture {
  return canvasTex(256, 256, (g) => {
    const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, color);
    grad.addColorStop(0.35, color);
    grad.addColorStop(0.42, "rgba(255,200,140,0.5)");
    grad.addColorStop(1, "rgba(255,160,120,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
  });
}

/** A faded striped beach towel, with its label. Soft colours, so the cards still read on it. */
export function towelTexture(): THREE.CanvasTexture {
  return canvasTex(1024, 1024, (g) => {
    const stripes = ["#3fa7a3", "#f3e6c8", "#e98a6b", "#f3e6c8", "#f2c35b", "#f3e6c8"];
    const w = 1024 / 12;
    for (let i = 0; i < 12; i++) {
      g.fillStyle = stripes[i % stripes.length] ?? "#f3e6c8";
      g.fillRect(i * w, 0, w, 1024);
    }
    // terry-cloth fuzz, and a sun-faded middle
    speckle(g, 12000, 2, () => `rgba(${Math.random() < 0.5 ? "0,0,0" : "255,255,255"},${Math.random() * 0.06})`);
    const fade = g.createRadialGradient(512, 512, 80, 512, 512, 560);
    fade.addColorStop(0, "rgba(255,248,230,0.35)");
    fade.addColorStop(1, "rgba(255,248,230,0)");
    g.fillStyle = fade;
    g.fillRect(0, 0, 1024, 1024);
    g.save();
    g.translate(512, 900);
    g.fillStyle = "rgba(255,255,255,0.85)";
    g.fillRect(-150, -28, 300, 56);
    g.fillStyle = "#2c6f7a";
    g.font = `bold 30px ${FONT}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("100% OUT OF OFFICE", 0, 2);
    g.restore();
  });
}

/** Red and white panels round an umbrella (u runs round it). */
export function stripesTexture(a: string, b: string, count: number): THREE.CanvasTexture {
  return canvasTex(256, 16, (g) => {
    const w = 256 / count;
    for (let i = 0; i < count; i++) {
      g.fillStyle = i % 2 ? b : a;
      g.fillRect(i * w, 0, w, 16);
    }
  });
}

/** The surf shack's sign: painted planks, a bit weathered. */
export function plankSignTexture(): THREE.CanvasTexture {
  return canvasTex(1024, 432, (g) => {
    const planks = ["#3fa7a3", "#e98a6b", "#f2c35b", "#5ab8d6"];
    const h = 432 / planks.length;
    planks.forEach((color, i) => {
      g.fillStyle = color;
      g.fillRect(0, i * h, 1024, h - 6);
      g.fillStyle = "#6b4a2e";
      g.fillRect(0, i * h + h - 6, 1024, 6);
      for (const x of [40, 984]) {
        g.fillStyle = "#4a3a2a";
        g.beginPath();
        g.arc(x, i * h + h / 2, 7, 0, Math.PI * 2);
        g.fill();
      }
    });
    // sun-bleached
    speckle(g, 3600, 3, () => `rgba(255,255,255,${Math.random() * 0.18})`);
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.lineJoin = "round";
    const paint = (text: string, y: number, size: number, fill: string) => {
      g.font = `bold ${size}px ${FONT}`;
      g.lineWidth = size / 6;
      g.strokeStyle = "#3a2618";
      g.strokeText(text, 512, y);
      g.fillStyle = fill;
      g.fillText(text, 512, y);
    };
    paint("POINT POKER", 150, 150, "#fff8e8");
    paint("surf · sand · story points", 300, 52, "#fff8e8");
    paint("est. whenever", 380, 34, "#3a2618");
  });
}
