// The poker table and the ticket lying on it. The shape and place come from
// `layout`; what it's made of comes from the environment.
import * as THREE from "three";
import type { BuiltEnvironment } from "../environments/types.ts";
import type { Layout } from "./layout.ts";
import { FONT, drawTicket } from "./textures.ts";

export function buildTable(layout: Layout, mats: BuiltEnvironment["tableMaterials"]): THREE.Group {
  const { y, rx, rz } = layout.table;
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.06, 64), [mats.wood, mats.felt, mats.wood]);
  top.scale.set(rx, 1, rz);
  top.position.y = y - 0.03;
  top.receiveShadow = true;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 12, 96), mats.trim);
  rim.rotation.x = Math.PI / 2;
  rim.scale.set(rx + 0.03, rz + 0.03, 1);
  rim.position.y = y;
  rim.castShadow = rim.receiveShadow = true;
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.96, 0.16, 64), mats.wood);
  skirt.scale.set(rx, 1, rz);
  skirt.position.y = y - 0.12;
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.5, 0.7, 24), mats.base);
  leg.position.y = 0.35;
  leg.castShadow = true;
  g.add(top, rim, skirt, leg);
  return g;
}

/** The ticket, as a sheet of paper in the middle of the felt. */
export class TicketPaper {
  readonly mesh: THREE.Mesh;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly tex: THREE.CanvasTexture;

  constructor(layout: Layout) {
    const c = document.createElement("canvas");
    c.width = 512; c.height = 380;
    this.ctx = c.getContext("2d")!;
    this.tex = new THREE.CanvasTexture(c);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 8;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.52), new THREE.MeshStandardMaterial({ map: this.tex, roughness: 1, color: "#b8ab95" }));
    const { position: p, yaw } = layout.anchors.ticket;
    this.mesh.rotation.set(-Math.PI / 2, 0, Math.PI / 2 + yaw); // readable from the dealer's side… and upside down for half the table, as is tradition
    this.mesh.position.set(p.x, p.y, p.z);
    this.mesh.receiveShadow = true;
    this.set(null);
  }

  set(t: { key: string; type: string; summary: string; points: string } | null) {
    if (t) drawTicket(this.ctx, t.key, t.type, t.summary, t.points);
    else {
      const g = this.ctx;
      g.fillStyle = "#efe4c8"; g.fillRect(0, 0, 512, 380);
      g.fillStyle = "#7a5a40"; g.font = `bold 40px ${FONT}`; g.textAlign = "center";
      g.fillText("(no ticket yet)", 256, 200); g.textAlign = "left";
    }
    this.tex.needsUpdate = true;
  }
}
