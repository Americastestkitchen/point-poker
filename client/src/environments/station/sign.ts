// The sign: the Point Poker logo set in tiles on the wall across the tracks,
// the way old stations put their names up. Same tubes as the neon sign, laid
// out on a grid and filled in one little tile at a time.
import * as THREE from "three";
import { LOGO } from "../../../../shared/brand.ts";
import { context2d } from "../../scene/art/textures.ts";
import type { EnvCtx, Sign } from "../types.ts";

/** Tiles across the logo, and each tile's size on the canvas. */
const ACROSS = 92;
const TILE = 11;
/** The gold border, in tiles. */
const BORDER = 3;

/** Shades of each tile colour; a tile picks one, so the wall looks hand-laid. */
const GROUND = ["#174c3d", "#1b5a49", "#195243", "#1f604f"];
const CREAM = ["#f4ecd2", "#ece2c4", "#f8f0da"];
const PINK = ["#ff3f8e", "#f0307f", "#ff5a9e"];
const GOLD = ["#c79a3a", "#b98b30", "#d2a548"];

const pick = (shades: readonly string[]) => shades[Math.floor(Math.random() * shades.length)] ?? "#000";

/** The logo drawn one pixel per tile: which tiles are cyan tube, pink tube, or wall. */
function tileMask(across: number, down: number): (x: number, y: number) => "cream" | "pink" | null {
  const canvas = document.createElement("canvas");
  canvas.width = across;
  canvas.height = down;
  const c = context2d(canvas);
  const { box, tubes } = LOGO;
  const px = across / box.width;
  c.lineCap = "round";
  c.lineJoin = "round";
  for (const t of tubes) {
    const k = t.scale * px;
    c.setTransform(k, 0, 0, k, (t.x - box.x) * px, (t.y - box.y) * px);
    c.lineWidth = t.weight * 2.3; // tiles need fatter strokes than glass does
    c.strokeStyle = t.tone === "pink" ? "#ff0000" : "#0000ff";
    c.stroke(new Path2D(t.d));
  }
  const { data } = c.getImageData(0, 0, across, down);
  return (x, y) => {
    const i = (y * across + x) * 4;
    const alpha = data[i + 3];
    if (typeof alpha !== "number" || alpha < 110) return null;
    return (data[i] ?? 0) > (data[i + 2] ?? 0) ? "pink" : "cream";
  };
}

export function mosaicSign({ onFrame }: EnvCtx): Sign {
  const down = Math.round((ACROSS * LOGO.box.height) / LOGO.box.width);
  const cols = ACROSS + BORDER * 2;
  const rows = down + BORDER * 2;
  const mask = tileMask(ACROSS, down);
  const canvas = document.createElement("canvas");
  canvas.width = cols * TILE;
  canvas.height = rows * TILE;
  const g = context2d(canvas);
  g.fillStyle = "#8f8875"; // grout
  g.fillRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const inside = x >= BORDER && y >= BORDER && x < cols - BORDER && y < rows - BORDER;
      const tone = inside ? mask(x - BORDER, y - BORDER) : null;
      g.fillStyle = !inside ? pick(GOLD) : tone === "pink" ? pick(PINK) : tone === "cream" ? pick(CREAM) : pick(GROUND);
      g.fillRect(x * TILE + 1, y * TILE + 1, TILE - 1.5, TILE - 1.5);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;

  const width = 2.5;
  const height = (width * rows) / cols;
  const object = new THREE.Group();
  const glaze = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.3, metalness: 0.05 });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(width, height), glaze);
  face.position.z = 0.02;
  object.add(face);
  // two brass lamps over it, and the light they throw
  const brass = new THREE.MeshStandardMaterial({ color: "#c79a3a", metalness: 0.7, roughness: 0.35 });
  const bulb = new THREE.MeshBasicMaterial({ color: "#fff1c4" });
  for (const x of [-0.7, 0.7]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.3), brass);
    arm.rotation.x = Math.PI / 2;
    arm.position.set(x, height / 2 + 0.1, 0.15);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.1, 10, 1, true), brass);
    shade.position.set(x, height / 2 + 0.08, 0.3);
    shade.rotation.x = -0.5;
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), bulb);
    glow.position.set(x, height / 2 + 0.05, 0.31);
    object.add(arm, shade, glow);
  }
  const light = new THREE.PointLight("#ffe2a8", 1.6, 4.5, 1.6);
  light.position.set(0, height / 2, 0.8);
  object.add(light);
  // the lamps hum along with the strip lights, a touch unsteady
  onFrame((_, t) => {
    light.intensity = 1.6 + Math.sin(t * 7.3) * 0.05;
  });
  return { object };
}
