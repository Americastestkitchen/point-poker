// Async Atoll: the team that works from anywhere finally goes somewhere. A
// sunset beach with a chalkboard on an easel, a surf shack sign, a duck in a
// swim ring and shades, a towel for felt, and plenty to click.
import * as THREE from "three";
import { toon } from "../../scene/art/materials.ts";
import { FONT, canvasTex, woodTexture, wrapText } from "../../scene/art/textures.ts";
import { speckle, textLines } from "../kit/canvas.ts";
import { rubberDuck } from "../kit/props/duck.ts";
import { statusCanvas, type PaintStatus } from "../kit/status.ts";
import type { Environment, Sign, StatusScreen } from "../types.ts";
import { eggs } from "./eggs.ts";
import { shore } from "./shore.ts";
import { plankSignTexture, stripesTexture, towelTexture } from "./textures.ts";

const HAZE = "#f3b28c";

export default {
  backdrop(ctx) {
    const object = new THREE.Group();
    object.add(shore(ctx), eggs(ctx));
    return { object, background: new THREE.Color(HAZE), fog: new THREE.Fog(HAZE, 16, 48), exposure: 1 };
  },
  tableMaterials: () => {
    const driftwood = woodTexture("#b9a68c", "#8d7a63", 2);
    return {
      felt: new THREE.MeshStandardMaterial({ map: towelTexture(), roughness: 1 }),
      wood: new THREE.MeshStandardMaterial({ map: driftwood, roughness: 0.9 }),
      trim: new THREE.MeshStandardMaterial({ color: "#d9c08f", roughness: 0.95 }),
      base: new THREE.MeshStandardMaterial({ color: "#9c8a72", roughness: 0.9 }),
    };
  },
  props: { statusScreen: chalkboard, sign: surfShackSign, squeaky: rubberDuck(beachDuck) },
} satisfies Environment;

/** A chalkboard on an easel standing in the sand, like a beach bar's specials. */
function chalkboard(): StatusScreen {
  const object = new THREE.Group();
  const status = statusCanvas(512, 384, paintChalk);
  const wood = toon("#a0703a");
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.94, 0.05), wood);
  frame.position.z = -0.03;
  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(1.14, 0.84),
    new THREE.MeshBasicMaterial({ map: status.texture }),
  );
  board.position.z = 0.0;
  const tray = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.1), wood);
  tray.position.set(0, -0.5, 0.03);
  object.add(frame, board, tray);
  // three legs down to the sand (the anchor is a telly's height up)
  const legs: [number, number, number][] = [
    [-0.5, 0.12, 0.08],
    [0.5, -0.12, 0.08],
    [0, 0, -0.5],
  ];
  for (const [x, tilt, back] of legs) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.5, 0.04), wood);
    leg.position.set(x * 0.9, -0.75, back * 0.4);
    leg.rotation.set(back < 0 ? -0.22 : 0.06, 0, tilt);
    leg.castShadow = true;
    object.add(leg);
  }
  frame.castShadow = true;
  return status.screen(object);
}

const paintChalk: PaintStatus = (g, lines) => {
  g.fillStyle = "#26372e";
  g.fillRect(0, 0, 512, 384);
  // old chalk, rubbed out
  speckle(g, 1400, 3, () => `rgba(255,255,255,${Math.random() * 0.05})`);
  g.textAlign = "center";
  g.fillStyle = "#fffbe8";
  g.font = `bold 60px ${FONT}`;
  g.fillText(lines.title, 256, 92, 470);
  g.font = `30px ${FONT}`;
  g.fillStyle = "#e9f2ea";
  textLines(g, wrapText(g, lines.subtitle, 450, 4), 256, 150, 38);
  g.fillStyle = "#ffb3c7";
  g.font = `bold 40px ${FONT}`;
  g.fillText(lines.status, 256, 344, 470);
  // a little sun doodle in the corner
  g.strokeStyle = "rgba(255,210,63,0.8)";
  g.lineWidth = 4;
  g.beginPath();
  g.arc(470, 40, 14, 0, Math.PI * 2);
  g.stroke();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.beginPath();
    g.moveTo(470 + Math.cos(a) * 20, 40 + Math.sin(a) * 20);
    g.lineTo(470 + Math.cos(a) * 28, 40 + Math.sin(a) * 28);
    g.stroke();
  }
  // chalk is never solid
  speckle(g, 2500, 2, () => "rgba(38,55,46,0.55)");
};

/** Painted planks nailed to two posts in the sand, like a surf shack's sign. */
function surfShackSign(): Sign {
  const object = new THREE.Group();
  const w = 2.6;
  const h = (w * 432) / 1024;
  const edge = toon("#6b4a2e");
  const painted = toon("#ffffff", { map: plankSignTexture() });
  // a box's faces go +x, -x, +y, -y, +z (the front), -z
  const face = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.06), [edge, edge, edge, edge, painted, edge]);
  face.rotation.z = 0.03; // nailed up by hand
  face.castShadow = true;
  object.add(face);
  for (const x of [-0.95, 0.95]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 2.75, 8), toon("#7a5a3a"));
    post.position.set(x, -0.8, -0.06);
    post.castShadow = true;
    object.add(post);
  }
  // a surfboard leaning on one post
  const board = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.2, 1.5, 4, 12),
    toon("#ffffff", {
      map: canvasTex(64, 256, (g) => {
        g.fillStyle = "#fff4e0";
        g.fillRect(0, 0, 64, 256);
        g.fillStyle = "#e4573d";
        g.fillRect(26, 0, 12, 256);
      }),
    }),
  );
  board.scale.z = 0.18;
  board.position.set(1.25, -1.25, 0.1);
  board.rotation.z = -0.18;
  board.castShadow = true;
  object.add(board);
  return { object };
}

/** The duck, dressed for the beach: a striped swim ring and sunglasses. */
function beachDuck(duck: THREE.Group) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.088, 0.024, 8, 24),
    toon("#ffffff", { map: stripesTexture("#e4573d", "#ffffff", 8) }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.05;
  ring.castShadow = true;
  const shades = new THREE.Group();
  const black = new THREE.MeshBasicMaterial({ color: "#111" });
  for (const s of [-1, 1]) {
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.018, 12), black);
    lens.position.x = s * 0.024;
    shades.add(lens);
  }
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.004, 0.004), black);
  shades.add(bridge);
  shades.position.set(0.091, 0.148, 0);
  shades.rotation.y = Math.PI / 2; // the duck looks along +x
  duck.add(ring, shades);
}
