// The ticket, as a sheet of paper in the middle of the felt.
import * as THREE from "three";
import { FONT, drawTicket } from "../art/textures.ts";
import type { Layout } from "../layout/layout.ts";

export interface TicketPaper {
  readonly mesh: THREE.Mesh;
  /** Draws a ticket on the paper, or "(no ticket yet)". */
  set(ticket: { key: string; type: string; summary: string; points: string } | null): void;
}

export function createTicketPaper(layout: Layout): TicketPaper {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 380;
  const ctx = canvas.getContext("2d")!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.7, 0.52),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 1, color: "#b8ab95" }),
  );
  const { position: p, yaw } = layout.anchors.ticket;
  mesh.rotation.set(-Math.PI / 2, 0, Math.PI / 2 + yaw); // readable from the dealer's side… and upside down for half the table, as is tradition
  mesh.position.set(p.x, p.y, p.z);
  mesh.receiveShadow = true;

  const paper: TicketPaper = {
    mesh,
    set(t) {
      if (t) drawTicket(ctx, t.key, t.type, t.summary, t.points);
      else {
        ctx.fillStyle = "#efe4c8";
        ctx.fillRect(0, 0, 512, 380);
        ctx.fillStyle = "#7a5a40";
        ctx.font = `bold 40px ${FONT}`;
        ctx.textAlign = "center";
        ctx.fillText("(no ticket yet)", 256, 200);
        ctx.textAlign = "left";
      }
      tex.needsUpdate = true;
    },
  };
  paper.set(null);
  return paper;
}
