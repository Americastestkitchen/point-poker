// Canvas-drawn textures: cards, felt, signage, name tags.
import * as THREE from "three";
import { CARD_SUIT } from "../../../../shared/catalog/decks.ts";

export function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export const FONT = `"Fredoka", "Baloo 2", "Trebuchet MS", system-ui, sans-serif`;

export const CARD_SERIF = `"Georgia", "Times New Roman", serif`;

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

const frontCache = new Map<number, THREE.CanvasTexture>();
export function cardFront(value: number): THREE.CanvasTexture {
  let t = frontCache.get(value);
  if (t) return t;
  const suit = CARD_SUIT[value] ?? { glyph: "♠", red: false };
  const ink = suit.red ? "#a8242c" : "#1d1a1a";
  let seed = value * 9301 + 49297;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  t = canvasTex(256, 368, (g) => {
    g.fillStyle = "#1b1410";
    g.fillRect(0, 0, 256, 368);
    roundRect(g, 3, 3, 250, 362, 14);
    const paper = g.createLinearGradient(0, 0, 256, 368);
    paper.addColorStop(0, "#f4efe3");
    paper.addColorStop(1, "#e2d8c2");
    g.fillStyle = paper;
    g.fill();
    g.save();
    g.clip();
    // grime, scuffs and a coffee ring, because these cards have been through some sprints
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(80,60,30,${rnd() * 0.06})`;
      g.fillRect(rnd() * 256, rnd() * 368, 2 + rnd() * 3, 2 + rnd() * 3);
    }
    if (rnd() < 0.5) {
      g.strokeStyle = "rgba(120,80,30,0.12)";
      g.lineWidth = 5;
      g.beginPath();
      g.arc(60 + rnd() * 140, 80 + rnd() * 200, 40 + rnd() * 20, 0, Math.PI * 1.7);
      g.stroke();
    }
    g.strokeStyle = "rgba(0,0,0,0.12)";
    g.lineWidth = 2;
    g.strokeRect(14, 14, 228, 340);
    g.restore();
    // slightly misregistered print
    const ox = (rnd() - 0.5) * 6,
      oy = (rnd() - 0.5) * 6;
    g.fillStyle = ink;
    g.textAlign = "center";
    g.textBaseline = "middle";
    const corner = (x: number, y: number, rot: number) => {
      g.save();
      g.translate(x + ox, y + oy);
      g.rotate(rot);
      g.font = `bold ${value >= 10 ? 34 : 40}px ${CARD_SERIF}`;
      g.fillText(String(value), 0, 0);
      g.font = `30px ${CARD_SERIF}`;
      g.fillText(suit.glyph, 0, 36);
      g.restore();
    };
    corner(34, 40, 0);
    corner(222, 328, Math.PI);
    g.save();
    g.translate(128 + ox, 184 + oy);
    g.rotate((rnd() - 0.5) * 0.06);
    g.globalAlpha = 0.1;
    g.font = `220px ${CARD_SERIF}`;
    g.fillText(suit.glyph, 0, 10);
    g.globalAlpha = 1;
    g.font = `bold ${value >= 10 ? 118 : 150}px ${CARD_SERIF}`;
    g.fillText(String(value), 0, 6);
    g.restore();
  });
  frontCache.set(value, t);
  return t;
}

let back: THREE.CanvasTexture | null = null;
export function cardBack(): THREE.CanvasTexture {
  back ??= canvasTex(256, 368, (g) => {
    g.fillStyle = "#1b1410";
    g.fillRect(0, 0, 256, 368);
    roundRect(g, 4, 4, 248, 360, 22);
    g.fillStyle = "#8e2233";
    g.fill();
    g.save();
    g.clip();
    g.strokeStyle = "rgba(255,170,150,0.3)";
    g.lineWidth = 3;
    for (let i = -400; i < 400; i += 22) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i + 368, 368);
      g.stroke();
      g.beginPath();
      g.moveTo(i + 368, 0);
      g.lineTo(i, 368);
      g.stroke();
    }
    g.restore();
    roundRect(g, 18, 18, 220, 332, 14);
    g.strokeStyle = "#e6be5a";
    g.lineWidth = 5;
    g.stroke();
    g.beginPath();
    g.ellipse(128, 184, 62, 62, 0, 0, Math.PI * 2);
    g.fillStyle = "#8e2233";
    g.fill();
    g.stroke();
    g.fillStyle = "#e6be5a";
    g.font = `bold 54px ${FONT}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("PP", 128, 188);
  });
  return back;
}

export function woodTexture(base = "#3b2416", lines = "#24140b", repeat = 4): THREE.CanvasTexture {
  const t = canvasTex(512, 512, (g) => {
    g.fillStyle = base;
    g.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 512; y += 64) {
      g.fillStyle = lines;
      g.fillRect(0, y, 512, 3);
      const off = (y / 64) % 2 ? 0 : 256;
      g.fillRect(off, y, 3, 64);
      for (let k = 0; k < 14; k++) {
        g.strokeStyle = `rgba(0,0,0,${0.08 + Math.random() * 0.1})`;
        g.beginPath();
        const yy = y + 6 + Math.random() * 54;
        g.moveTo(0, yy);
        g.bezierCurveTo(170, yy + Math.random() * 6 - 3, 340, yy + Math.random() * 6 - 3, 512, yy);
        g.stroke();
      }
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  return t;
}

export function wrapText(
  g: { measureText(text: string): { width: number } },
  text: string,
  maxW: number,
  maxLines: number,
): string[] {
  if (maxLines <= 0) return [];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? line + " " + w : w;
    if (g.measureText(next).width > maxW && line) {
      lines.push(line);
      line = w;
      if (lines.length === maxLines) break;
    } else line = next;
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
    const last = lines.at(-1);
    if (last !== undefined) lines[lines.length - 1] = last.replace(/\s*\S*$/, "") + "…";
  }
  return lines;
}

export function drawTicket(g: CanvasRenderingContext2D, key: string, type: string, summary: string, points: string) {
  const W = g.canvas.width,
    H = g.canvas.height;
  g.clearRect(0, 0, W, H);
  g.fillStyle = "#efe4c8";
  g.fillRect(0, 0, W, H);
  g.fillStyle = "rgba(120,90,40,0.12)";
  for (let i = 0; i < 40; i++) g.fillRect(Math.random() * W, Math.random() * H, 30 + Math.random() * 60, 2);
  g.fillStyle = "#c0392b";
  g.fillRect(0, 0, W, 18);
  g.fillStyle = "#2a1d17";
  g.font = `bold 46px ${FONT}`;
  g.textBaseline = "top";
  g.fillText(key, 28, 40);
  g.font = `24px ${FONT}`;
  g.fillStyle = "#7a5a40";
  g.fillText(type.toUpperCase(), 30, 96);
  g.fillStyle = "#2a1d17";
  g.font = `30px ${FONT}`;
  wrapText(g, summary, W - 56, 6).forEach((l, i) => g.fillText(l, 28, 140 + i * 38));
  if (points) {
    g.save();
    g.translate(W - 120, H - 90);
    g.rotate(-0.25);
    g.strokeStyle = "#c0392b";
    g.lineWidth = 6;
    g.strokeRect(-95, -40, 190, 80);
    g.fillStyle = "#c0392b";
    g.font = `bold 40px ${FONT}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(points, 0, 2);
    g.restore();
  }
}
