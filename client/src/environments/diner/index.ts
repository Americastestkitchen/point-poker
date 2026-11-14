// Deploy Diner: open 24/7, like prod. A 50s diner with a checkerboard floor,
// red booths and chrome, the ticket clipped to the kitchen's order rail, a neon
// sign that can't decide if it's open, and a ketchup bottle that splorts.
import * as THREE from "three";
import { NEON } from "../../../../shared/brand.ts";
import { toon } from "../../scene/art/materials.ts";
import { FONT, canvasTex, wrapText } from "../../scene/art/textures.ts";
import { flickeringNeonLogo } from "../kit/neon.ts";
import { statusCanvas, type PaintStatus } from "../kit/status.ts";
import type { EnvCtx, Environment, Sign, StatusScreen } from "../types.ts";
import { hotfixSign, jukebox, orderBell, pieCase, specialsBoard } from "./eggs.ts";
import { ketchupBottle } from "./ketchup.ts";
import { buildRoom, chrome, kitchenHatch, pendants, ROOM } from "./room.ts";
import { dinerAmbience } from "./sound.ts";
import { paintFormica, RED, TEAL } from "./textures.ts";

export default {
  backdrop(ctx) {
    const { anchors, sound, onFrame } = ctx;
    const object = new THREE.Group();
    object.add(new THREE.HemisphereLight("#fff4e0", "#7a4a40", 1.7));
    object.add(new THREE.AmbientLight("#ffffff", 0.35));
    buildRoom(object);
    object.add(kitchenHatch(anchors.statusScreen));
    const lamps = pendants(anchors.lamp);
    object.add(lamps.object);
    onFrame((_, t) => lamps.update(t));
    specialsBoard(object, ctx);
    hotfixSign(object, ctx);
    orderBell(object, ctx);
    pieCase(object, ctx);
    jukebox(object, ctx);
    sound.bed(dinerAmbience);
    return { object, background: new THREE.Color("#1a1020"), fog: null };
  },
  tableMaterials: () => ({
    felt: new THREE.MeshStandardMaterial({ map: tableTop(), roughness: 0.35 }),
    wood: new THREE.MeshStandardMaterial({ color: "#7d8a93", metalness: 0.6, roughness: 0.3 }),
    trim: new THREE.MeshStandardMaterial({ color: "#c4ced5", metalness: 0.55, roughness: 0.18 }),
    base: new THREE.MeshStandardMaterial({ color: "#1d1d22", metalness: 0.4, roughness: 0.4 }),
  }),
  props: { statusScreen: orderRail, sign: dinerSign, squeaky: ketchupBottle },
} satisfies Environment;

/** Cherry formica with a cream ring and the house rules round the edge. */
function tableTop() {
  return canvasTex(1024, 1024, (g) => {
    paintFormica(g, 1024);
    g.strokeStyle = "rgba(255,240,215,0.7)";
    g.lineWidth = 6;
    g.beginPath();
    g.ellipse(512, 512, 335, 335, 0, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = "rgba(255,240,215,0.75)";
    g.font = `bold 34px ${FONT}`;
    g.textAlign = "center";
    const msg = "  NO SUBSTITUTIONS  ✦  ALL ESTIMATES FINAL  ✦  NO SHIRT, NO SHOES, NO DEPLOYS  ✦";
    const r = 395;
    for (let i = 0; i < msg.length; i++) {
      const a = (i / msg.length) * Math.PI * 2 - Math.PI / 2;
      g.save();
      g.translate(512 + Math.cos(a) * r, 512 + Math.sin(a) * r);
      g.rotate(a + Math.PI / 2);
      g.fillText(msg.charAt(i), 0, 0);
      g.restore();
    }
  });
}

/** The Point Poker logo in neon on a chrome-edged board, and an OPEN 24/7 that isn't always. */
function dinerSign({ onFrame }: EnvCtx): Sign {
  const object = new THREE.Group();
  const logo = flickeringNeonLogo(2.0);
  logo.object.position.y = 0.3;
  const board = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.95, 0.06), toon("#2b1c2c"));
  board.position.set(0, 0.05, -0.04);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(2.3, 2.05, 0.04), chrome());
  edge.position.set(0, 0.05, -0.07);
  // OPEN 24/7 in a rounded red tube, under the logo
  const frame = neonPlane(1.9, 0.42, (g, W, H, tube) =>
    tube(() => {
      g.beginPath();
      g.roundRect(14, 14, W - 28, H - 28, (H - 28) / 2);
      g.stroke();
    }),
  );
  const open = neonPlane(0.95, 0.42, (g, W, H, tube) => tube(() => g.strokeText("OPEN", W / 2, H / 2 + 4)));
  const hours = neonPlane(0.75, 0.42, (g, W, H, tube) => tube(() => g.strokeText("24/7", W / 2, H / 2 + 4)));
  frame.mesh.position.set(0, -0.62, 0.001);
  open.mesh.position.set(-0.4, -0.62, 0.002);
  hours.mesh.position.set(0.46, -0.62, 0.003);
  const light = new THREE.PointLight(NEON.pink.tube, 3, 6, 1.5);
  light.position.z = 0.5;
  // a touch bigger than the Basement's, and a little low so the board clears the ceiling
  const face = new THREE.Group();
  face.scale.setScalar(1.12);
  face.position.y = -0.07;
  face.add(edge, board, logo.object, frame.mesh, open.mesh, hours.mesh);
  object.add(face, light);
  onFrame((_, t) => {
    const lit = logo.update(t);
    // 24/7 drops out in little stutters now and then. Like prod.
    const stutter = Math.sin(t * 0.29 + 1) > 0.97;
    hours.mat.opacity = stutter && Math.sin(t * 37) > 0.2 ? 0.08 : 1;
    light.intensity = lit ? 3 : 2.4;
  });
  return { object };
}

type Tube = (draw: () => void) => void;

/** A glowing plane of red neon, `width` by `height` metres. `draw` strokes paths and text with `tube`. */
function neonPlane(
  width: number,
  height: number,
  draw: (g: CanvasRenderingContext2D, W: number, H: number, tube: Tube) => void,
) {
  const W = 512,
    H = Math.round((W * height) / width);
  const color = "#ff4d4d",
    core = "#ffe0dc";
  const map = canvasTex(W, H, (g) => {
    g.font = `bold ${Math.round(H * 0.56)}px ${FONT}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.lineJoin = "round";
    g.lineCap = "round";
    const tube: Tube = (path) => {
      for (const [stroke, lineWidth, blur] of [
        [color, 14, 24],
        [color, 7, 0],
        [core, 2.5, 0],
      ] as const) {
        g.save();
        g.strokeStyle = stroke;
        g.lineWidth = lineWidth;
        g.shadowColor = color;
        g.shadowBlur = blur;
        path();
        g.restore();
      }
    };
    draw(g, W, H, tube);
  });
  const mat = new THREE.MeshBasicMaterial({
    map,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  return { mesh: new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat), mat };
}

/** The kitchen's order rail, with the ticket clipped up as an order slip and two old orders beside it. */
function orderRail({ anchors, onFrame }: EnvCtx): StatusScreen {
  const object = new THREE.Group();
  const status = statusCanvas(384, 512, paintSlip);
  // The slip hangs from its clip and sways in the kitchen's draught.
  const pivot = new THREE.Group();
  pivot.position.y = 0.44;
  const slip = new THREE.Mesh(
    new THREE.PlaneGeometry(0.63, 0.84),
    new THREE.MeshBasicMaterial({ map: status.texture, color: "#f2efe8" }),
  );
  slip.position.y = -0.44;
  const clip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.03), chrome());
  clip.position.y = -0.02;
  pivot.add(slip, clip);
  object.add(pivot);
  // The rail and the old orders sit square to the wall; only the slip is turned towards the table.
  const wall = new THREE.Group();
  wall.rotation.y = -anchors.statusScreen.yaw;
  const shine = chrome();
  const toWall = -ROOM.x - anchors.statusScreen.position.x; // the wall is this far along x
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.9, 8), shine);
  rail.rotation.x = Math.PI / 2;
  rail.position.y = 0.45;
  wall.add(rail);
  for (const z of [-0.93, 0.93]) {
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(-toWall, 0.03, 0.03), shine);
    bracket.position.set(toWall / 2, 0.45, z);
    wall.add(bracket);
  }
  const oldOrder = new THREE.MeshBasicMaterial({ map: oldOrderTexture(), color: "#e8e2d4" });
  for (const [z, tilt] of [
    [0.62, 0.06],
    [-0.66, -0.08],
  ] as const) {
    const old = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.4), oldOrder);
    old.position.set(0, 0.25, z);
    old.rotation.set(0, Math.PI / 2, tilt);
    wall.add(old);
  }
  object.add(wall);
  let flutter = 0;
  onFrame((dt, t) => {
    flutter = Math.max(0, flutter - dt * 0.8);
    pivot.rotation.x = Math.sin(t * 1.3) * 0.025 + Math.sin(t * 9) * flutter * 0.12;
  });
  const screen = status.screen(object);
  return {
    object,
    show(title, subtitle, line) {
      screen.show(title, subtitle, line);
      flutter = 1;
    },
  };
}

const paintSlip: PaintStatus = (g, lines) => {
  const W = 384,
    H = 512;
  g.fillStyle = "#fffdf4";
  g.fillRect(0, 0, W, H);
  // faint ruled lines, like an order pad
  g.strokeStyle = "rgba(79,179,169,0.25)";
  g.lineWidth = 2;
  for (let y = 150; y < 430; y += 34) {
    g.beginPath();
    g.moveTo(20, y);
    g.lineTo(W - 20, y);
    g.stroke();
  }
  g.fillStyle = RED;
  g.fillRect(0, 0, W, 14);
  g.textAlign = "center";
  g.font = `bold 26px ${FONT}`;
  g.fillText("DEPLOY DINER · ORDER", W / 2, 50);
  g.font = `bold 66px ${FONT}`;
  g.fillText(lines.title, W / 2, 120, W - 30);
  g.fillStyle = "#2a2a2a";
  g.font = `30px "Comic Sans MS", ${FONT}`;
  wrapText(g, lines.subtitle, W - 50, 6).forEach((l, i) => g.fillText(l, W / 2, 178 + i * 34));
  // tear line
  g.strokeStyle = "#bbb";
  g.setLineDash([10, 8]);
  g.beginPath();
  g.moveTo(10, 440);
  g.lineTo(W - 10, 440);
  g.stroke();
  g.setLineDash([]);
  g.fillStyle = TEAL;
  g.font = `bold 36px ${FONT}`;
  g.fillText(lines.status, W / 2, 486, W - 30);
};

/** Someone else's order, already scribbled through. */
function oldOrderTexture() {
  return canvasTex(192, 256, (g) => {
    g.fillStyle = "#fff9e8";
    g.fillRect(0, 0, 192, 256);
    g.fillStyle = RED;
    g.fillRect(0, 0, 192, 8);
    g.font = `bold 24px ${FONT}`;
    g.textAlign = "center";
    g.fillText("ORDER #141", 96, 40);
    g.fillStyle = "#555";
    g.font = `20px "Comic Sans MS", ${FONT}`;
    ["2x hotfix", "side of logs", "no rollback", "ASAP!!"].forEach((l, i) => g.fillText(l, 96, 84 + i * 34));
    g.strokeStyle = "rgba(200,50,60,0.6)";
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(20, 230);
    g.lineTo(172, 60);
    g.stroke();
  });
}
