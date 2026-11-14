// Standup Station's own textures: subway tiles, platform concrete, the yellow
// edge line, and the seat-fabric moquette the table is covered in.
import * as THREE from "three";
import { FONT, canvasTex } from "../../scene/art/textures.ts";
import { speckle } from "../kit/canvas.ts";

/** How many metres one copy of a repeating texture covers. Set on the geometry with `tileUv`. */
export const TILE_METRES = 0.6;

/** Stretches a plane's UVs so a repeating texture keeps its real size (`metres` per copy). */
export function tileUv<G extends THREE.BufferGeometry>(geo: G, width: number, height: number, metres = TILE_METRES): G {
  const uv = geo.getAttribute("uv");
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * width) / metres, (uv.getY(i) * height) / metres);
  return geo;
}

const repeating = (t: THREE.CanvasTexture) => {
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
};

/** Cream subway tiles in a running bond, a bit grubby. */
export function tileTexture(): THREE.CanvasTexture {
  return repeating(
    canvasTex(256, 256, (g) => {
      g.fillStyle = "#b9b19b";
      g.fillRect(0, 0, 256, 256);
      for (let row = 0; row < 8; row++) {
        const shift = row % 2 ? 32 : 0;
        for (let col = -1; col < 4; col++) {
          const x = col * 64 + shift;
          const y = row * 32;
          const shade = 226 + Math.floor(Math.random() * 14);
          g.fillStyle = `rgb(${shade + 9},${shade + 4},${shade - 12})`;
          g.fillRect(x + 2, y + 2, 60, 28);
          g.fillStyle = "rgba(255,255,255,0.35)";
          g.fillRect(x + 5, y + 4, 34, 4);
        }
      }
      speckle(g, 700, 3, () => `rgba(60,50,30,${Math.random() * 0.1})`);
    }),
  );
}

/** Platform concrete: grey, with gum. */
export function concreteTexture(): THREE.CanvasTexture {
  return repeating(
    canvasTex(256, 256, (g) => {
      g.fillStyle = "#8f8a82";
      g.fillRect(0, 0, 256, 256);
      speckle(g, 3000, 2, () => `rgba(${Math.random() < 0.5 ? "40,36,30" : "220,214,200"},${Math.random() * 0.18})`);
      g.fillStyle = "rgba(60,56,50,0.5)";
      for (let i = 0; i < 4; i++) {
        g.beginPath();
        g.arc(Math.random() * 256, Math.random() * 256, 3 + Math.random() * 3, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = "rgba(0,0,0,0.2)";
      g.fillRect(0, 0, 256, 2);
      g.fillRect(0, 0, 2, 256);
    }),
  );
}

/**
 * The yellow line along the platform edge, `length` metres long and running along +x
 * (the platform's edge is on the canvas's top side), with the warning painted on it
 * every few metres, so there's always one in sight past the table.
 */
export function edgeLineTexture(length: number): THREE.CanvasTexture {
  const w = 4096;
  const perMetre = w / length;
  const h = Math.round(perMetre * 0.5);
  return canvasTex(w, h, (g) => {
    g.fillStyle = "#f0c419";
    g.fillRect(0, 0, w, h);
    // the bumps you feel with your feet
    g.fillStyle = "rgba(150,110,0,0.3)";
    const dot = Math.round(h / 10);
    for (let y = dot; y < h; y += dot * 2)
      for (let x = dot + ((y / (dot * 2)) % 2) * dot; x < w; x += dot * 2) g.fillRect(x, y, dot * 0.6, dot * 0.6);
    g.fillStyle = "#2b2622";
    g.textAlign = "center";
    g.textBaseline = "middle";
    const span = perMetre * 1.6;
    for (const z of [-3, 0, 3]) {
      const x = (z / length + 0.5) * w;
      g.font = `900 ${Math.round(h * 0.5)}px ${FONT}`;
      g.fillText("MIND THE GAP", x, h * 0.36, span);
      g.font = `700 ${Math.round(h * 0.22)}px ${FONT}`;
      g.fillText("(between the estimate and the actual)", x, h * 0.78, span);
    }
  });
}

/**
 * Tube-seat moquette, for the felt: navy with red and yellow squares and little dots,
 * and a ring of rider notices round the edge. The felt is stretched wider than it is
 * deep, so the pattern is drawn narrower to come out square.
 */
export function moquetteTexture(): THREE.CanvasTexture {
  return canvasTex(1024, 1024, (g) => {
    g.fillStyle = "#1b2a5e";
    g.fillRect(0, 0, 1024, 1024);
    const ch = 56;
    const cw = ch * (1.3 / 1.95); // the table is 1.95 m by 1.3 m
    for (let row = 0; row * ch < 1024; row++) {
      for (let col = 0; col * cw < 1024; col++) {
        const x = col * cw;
        const y = row * ch;
        const k = cw / ch;
        g.fillStyle = "#c93b47";
        g.fillRect(x + 6 * k, y + 6, 12 * k, 12);
        g.fillStyle = "#e0b43c";
        g.fillRect(x + 34 * k, y + 34, 12 * k, 12);
        g.fillStyle = "#2b9da2";
        g.beginPath();
        g.ellipse(x + 42 * k, y + 14, 5 * k, 5, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "#d9d4c8";
        g.beginPath();
        g.ellipse(x + 14 * k, y + 42, 5 * k, 5, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
    // worn a bit darker towards the edge, where elbows go
    const grad = g.createRadialGradient(512, 512, 200, 512, 512, 560);
    grad.addColorStop(0, "rgba(10,14,40,0.2)");
    grad.addColorStop(1, "rgba(10,14,40,0.55)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 1024, 1024);
    speckle(g, 6000, 2, () => `rgba(${Math.random() < 0.5 ? "0,0,0" : "255,255,255"},${Math.random() * 0.06})`);
    // a band for the notices
    g.strokeStyle = "#101a40";
    g.lineWidth = 64;
    g.beginPath();
    g.arc(512, 512, 400, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = "#e0b43c";
    g.lineWidth = 4;
    for (const r of [366, 434]) {
      g.beginPath();
      g.arc(512, 512, r, 0, Math.PI * 2);
      g.stroke();
    }
    g.fillStyle = "#f4ecd2";
    g.font = `bold 32px ${FONT}`;
    g.textAlign = "center";
    const msg = "  PRIORITY SEATING FOR ANYONE WITH A BLOCKER  ●  PLEASE STAND CLEAR OF THE CLOSING SPRINT  ●";
    for (let i = 0; i < msg.length; i++) {
      const a = (i / msg.length) * Math.PI * 2 - Math.PI / 2;
      g.save();
      g.translate(512 + Math.cos(a) * 400, 512 + Math.sin(a) * 400);
      g.rotate(a + Math.PI / 2);
      g.fillText(msg.charAt(i), 0, 11);
      g.restore();
    }
  });
}

/** A paper notice on the wall: a title and some lines, with a coloured header. */
export function posterTexture(header: string, color: string, lines: string[]): THREE.CanvasTexture {
  return canvasTex(384, 512, (g) => {
    g.fillStyle = "#f4efe3";
    g.fillRect(0, 0, 384, 512);
    g.fillStyle = color;
    g.fillRect(0, 0, 384, 150);
    g.fillStyle = "#fff";
    g.font = `900 46px ${FONT}`;
    g.textAlign = "center";
    header.split("\n").forEach((l, i) => g.fillText(l, 192, 70 + i * 52));
    g.fillStyle = "#2b2622";
    g.font = `600 30px ${FONT}`;
    lines.forEach((l, i) => g.fillText(l, 192, 220 + i * 44));
    speckle(g, 500, 3, () => `rgba(80,60,30,${Math.random() * 0.1})`);
    g.strokeStyle = "#2b2622";
    g.lineWidth = 10;
    g.strokeRect(0, 0, 384, 512);
  });
}
