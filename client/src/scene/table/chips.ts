// Poker chips: single chips and the stacks in front of each seat and in the pot.
import * as THREE from "three";
import { canvasTex } from "../art/textures.ts";

const CHIP_COLORS = { 1: "#c0392b", 5: "#2d6cdf", 25: "#151515", 100: "#e6be5a" } as const;
let chipGeo: THREE.CylinderGeometry | null = null;
const chipMats = new Map<string, THREE.Material>();
export function makeChip(color: string): THREE.Mesh {
  chipGeo ??= new THREE.CylinderGeometry(0.042, 0.042, 0.012, 20);
  let mat = chipMats.get(color);
  if (!mat) {
    const tex = canvasTex(64, 64, (g) => {
      g.fillStyle = color; g.fillRect(0, 0, 64, 64);
      g.fillStyle = "#f3e7cf";
      for (let i = 0; i < 6; i++) { g.save(); g.translate(32, 32); g.rotate((i / 6) * Math.PI * 2); g.fillRect(-4, -32, 8, 10); g.restore(); }
      g.strokeStyle = "#f3e7cf"; g.lineWidth = 2; g.beginPath(); g.arc(32, 32, 16, 0, Math.PI * 2); g.stroke();
    });
    mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4 });
    chipMats.set(color, mat);
  }
  const m = new THREE.Mesh(chipGeo, mat);
  m.castShadow = true;
  return m;
}

/** Breaks an amount into a capped list of chip colours, biggest first. */
export function chipBreakdown(amount: number, cap = 40): string[] {
  const out: string[] = [];
  let left = Math.floor(amount);
  for (const d of [100, 25, 5, 1] as const) {
    while (left >= d && out.length < cap) { out.push(CHIP_COLORS[d]); left -= d; }
  }
  return out;
}

export function stackChips(group: THREE.Group, amount: number, seed = 1) {
  group.clear();
  const colors = chipBreakdown(amount);
  let rnd = seed;
  const rand = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647);
  const perStack = 8;
  colors.forEach((c, i) => {
    const stack = Math.floor(i / perStack);
    const chip = makeChip(c);
    const a = stack * 2.4;
    const r = stack === 0 ? 0 : 0.06 + stack * 0.012;
    chip.position.set(Math.cos(a) * r + (rand() - 0.5) * 0.006, 0.006 + (i % perStack) * 0.0125, Math.sin(a) * r + (rand() - 0.5) * 0.006);
    chip.rotation.y = rand() * 6;
    group.add(chip);
  });
}
