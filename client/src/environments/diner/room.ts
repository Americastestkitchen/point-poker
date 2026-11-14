// The diner itself: checkerboard floor, cream and teal walls with a chrome
// stripe, the counter and its stools, booths under the night windows, the
// kitchen pass-through behind the dealer and the red pendants over the table.
import * as THREE from "three";
import { toon } from "../../scene/art/materials.ts";
import { FONT, canvasTex } from "../../scene/art/textures.ts";
import type { Anchor } from "../../scene/layout/layout.ts";
import { speckle } from "../kit/canvas.ts";
import { CHROME, RED, TEAL, checkerTexture, formicaTexture, nightTexture, wallpaperTexture } from "./textures.ts";

/** The room is 10 m along x and 8 m along z, 3.4 m high. */
export const ROOM = { x: 5, z: 4, h: 3.4 } as const;
/** How high the teal panelling goes. */
const WAINSCOT = 1.1;

export function chrome() {
  return new THREE.MeshStandardMaterial({ color: CHROME, metalness: 0.55, roughness: 0.22 });
}

function box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

/** Floor, walls, ceiling, counter, stools, booths and windows. */
export function buildRoom(s: THREE.Group) {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM.x * 2, ROOM.z * 2),
    new THREE.MeshStandardMaterial({ map: checkerTexture(ROOM.x * 2, ROOM.z * 2), roughness: 0.5 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  s.add(floor);

  const paper = new THREE.MeshStandardMaterial({ map: wallpaperTexture(), roughness: 0.9 });
  const teal = toon(TEAL);
  const shine = chrome();
  const walls: [number, number, number, number][] = [
    [0, -ROOM.z, 0, ROOM.x * 2],
    [0, ROOM.z, Math.PI, ROOM.x * 2],
    [-ROOM.x, 0, Math.PI / 2, ROOM.z * 2],
    [ROOM.x, 0, -Math.PI / 2, ROOM.z * 2],
  ];
  for (const [x, z, ry, w] of walls) {
    const wall = new THREE.Group();
    wall.position.set(x, 0, z);
    wall.rotation.y = ry;
    const upper = new THREE.Mesh(new THREE.PlaneGeometry(w, ROOM.h), paper);
    upper.position.y = ROOM.h / 2;
    upper.receiveShadow = true;
    const lower = new THREE.Mesh(new THREE.PlaneGeometry(w, WAINSCOT), teal);
    lower.position.set(0, WAINSCOT / 2, 0.01);
    wall.add(upper, lower);
    wall.add(box(w, 0.07, 0.04, shine, 0, WAINSCOT, 0.02), box(w, 0.1, 0.03, shine, 0, 0.05, 0.02));
    s.add(wall);
  }
  const ceil = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM.x * 2, ROOM.z * 2),
    toon("#fff4e0", { emissive: "#7a6a52" }),
  );
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = ROOM.h;
  s.add(ceil);

  counter(s, shine);
  booths(s, shine);
}

/** The counter along the back wall, its stools, and the napkins and sugar on it. */
function counter(s: THREE.Group, shine: THREE.Material) {
  const g = new THREE.Group();
  g.position.set(-0.6, 0, -ROOM.z + 0.35);
  const top = formicaTexture(256);
  top.repeat.set(6, 0.7);
  g.add(
    box(6.2, 0.95, 0.6, toon(TEAL), 0, 0.475, 0),
    box(6.3, 0.06, 0.72, new THREE.MeshStandardMaterial({ map: top, roughness: 0.4 }), 0, 0.98, 0.04),
    box(6.32, 0.04, 0.74, shine, 0, 0.94, 0.04),
    box(6.2, 0.1, 0.62, shine, 0, 0.05, 0.01),
  );
  // chrome stripes along the front
  for (const y of [0.3, 0.65]) g.add(box(6.2, 0.04, 0.02, shine, 0, y, 0.31));
  const seat = toon(RED);
  const pole = shine;
  for (let i = 0; i < 6; i++) {
    const x = -2.6 + i * 1.05;
    const stool = new THREE.Group();
    stool.position.set(x, 0, 0.72);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.66, 8), pole);
    post.position.y = 0.33;
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.04, 16), pole);
    foot.position.y = 0.02;
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.06, 16), pole);
    rim.position.y = 0.66;
    const cushion = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.09, 16), seat);
    cushion.position.y = 0.73;
    cushion.castShadow = true;
    stool.add(post, foot, rim, cushion);
    g.add(stool);
  }
  // a napkin dispenser and a sugar pourer every so often
  for (const x of [-1.8, 1.4]) {
    g.add(box(0.12, 0.13, 0.08, shine, x, 1.075, 0.12));
    const sugar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.04, 0.12, 10),
      new THREE.MeshStandardMaterial({ color: "#eaf6ff", transparent: true, opacity: 0.6, roughness: 0.1 }),
    );
    sugar.position.set(x + 0.18, 1.07, 0.1);
    g.add(sugar);
  }
  s.add(g);
}

/** Red booths under the windows along the front wall, a little table in each. */
function booths(s: THREE.Group, shine: THREE.Material) {
  const vinyl = toon(RED, { map: tuftTexture() });
  const white = toon("#f4f1ea");
  const night = new THREE.MeshBasicMaterial({ map: nightTexture(), color: "#9aa0c8" });
  const topMat = new THREE.MeshStandardMaterial({ map: formicaTexture(256), roughness: 0.4 });
  for (const x of [-3.0, 0, 3.0]) {
    const g = new THREE.Group();
    g.position.set(x, 0, ROOM.z);
    // two benches facing each other across the table, backs to the aisle
    for (const side of [-1, 1]) {
      const bx = side * 0.75;
      g.add(
        box(0.5, 0.45, 1.3, vinyl, bx, 0.225, -0.68),
        box(0.14, 1.15, 1.3, vinyl, bx + side * 0.25, 0.575, -0.68),
        box(0.18, 0.06, 1.32, shine, bx + side * 0.25, 1.17, -0.68),
        // the white piping stripe on the backrest
        box(0.15, 0.08, 1.31, white, bx + side * 0.25, 0.85, -0.68),
      );
    }
    const top = box(0.95, 0.04, 0.8, topMat, 0, 0.74, -0.6);
    const edge = box(0.97, 0.03, 0.82, shine, 0, 0.71, -0.6);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.7, 8), shine);
    leg.position.set(0, 0.36, -0.6);
    g.add(top, edge, leg);
    // a window over each booth, with the night outside
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.0), night);
    pane.position.set(0, 2.0, -0.02);
    pane.rotation.y = Math.PI;
    const frame = [
      box(1.62, 0.07, 0.06, shine, 0, 2.53, -0.03),
      box(1.62, 0.07, 0.06, shine, 0, 1.47, -0.03),
      box(0.07, 1.1, 0.06, shine, -0.78, 2.0, -0.03),
      box(0.07, 1.1, 0.06, shine, 0.78, 2.0, -0.03),
      box(0.04, 1.0, 0.04, shine, 0, 2.0, -0.03),
    ];
    g.add(pane, ...frame);
    s.add(g);
  }
}

/** Red vinyl in vertical channels, the way diner booths are stitched. */
function tuftTexture() {
  return canvasTex(128, 128, (g) => {
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, 128, 128);
    for (let x = 0; x < 128; x += 32) {
      const shade = g.createLinearGradient(x, 0, x + 32, 0);
      shade.addColorStop(0, "rgba(0,0,0,0.28)");
      shade.addColorStop(0.35, "rgba(255,255,255,0)");
      shade.addColorStop(0.6, "rgba(255,255,255,0.18)");
      shade.addColorStop(1, "rgba(0,0,0,0.22)");
      g.fillStyle = shade;
      g.fillRect(x, 0, 32, 128);
    }
  });
}

/** The hatch into the kitchen behind the dealer, lined up with the order rail. */
export function kitchenHatch(anchor: Anchor) {
  const g = new THREE.Group();
  g.position.set(-ROOM.x, 0, anchor.position.z);
  g.rotation.y = Math.PI / 2;
  const w = 2.4;
  const bottom = 1.15;
  const top = anchor.position.y + 0.62;
  const h = top - bottom;
  const inside = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: kitchenTexture(), color: "#b8a48c" }),
  );
  inside.position.set(0, bottom + h / 2, 0.015);
  const shine = chrome();
  g.add(
    inside,
    box(w + 0.16, 0.08, 0.08, shine, 0, top + 0.04, 0.04),
    box(0.08, h, 0.08, shine, -w / 2 - 0.04, bottom + h / 2, 0.04),
    box(0.08, h, 0.08, shine, w / 2 + 0.04, bottom + h / 2, 0.04),
    // the pass shelf, where plates (and bells) go
    box(w + 0.3, 0.06, 0.42, shine, 0, bottom, 0.2),
  );
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.7, 0.26),
    new THREE.MeshStandardMaterial({
      roughness: 0.6,
      map: canvasTex(680, 104, (x) => {
        x.fillStyle = "#fffdf4";
        x.fillRect(0, 0, 680, 104);
        x.strokeStyle = RED;
        x.lineWidth = 10;
        x.strokeRect(5, 5, 670, 94);
        x.fillStyle = RED;
        x.font = `bold 50px ${FONT}`;
        x.textAlign = "center";
        x.fillText("NO DEVS PAST THIS POINT", 340, 70);
      }),
    }),
  );
  sign.position.set(0, top + 0.33, 0.02);
  g.add(sign);
  // the heat lamp's warm spill through the hatch
  const light = new THREE.PointLight("#ffb46a", 2.2, 4.5, 1.6);
  light.position.set(0, top - 0.3, 0.5);
  g.add(light);
  return g;
}

/** What you can see through the hatch: tiles, a hood, pans and a steaming pot. */
function kitchenTexture() {
  return canvasTex(512, 256, (g) => {
    g.fillStyle = "#e9e4da";
    g.fillRect(0, 0, 512, 256);
    g.strokeStyle = "rgba(90,90,90,0.25)";
    g.lineWidth = 2;
    for (let x = 0; x <= 512; x += 32) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, 256);
      g.stroke();
    }
    for (let y = 0; y <= 256; y += 32) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(512, y);
      g.stroke();
    }
    speckle(g, 400, 3, () => `rgba(120,90,40,${Math.random() * 0.15})`);
    // the hood
    g.fillStyle = "#9aa4ab";
    g.beginPath();
    g.moveTo(90, 0);
    g.lineTo(420, 0);
    g.lineTo(460, 70);
    g.lineTo(50, 70);
    g.fill();
    g.fillStyle = "#3a3a3a";
    g.fillRect(40, 210, 432, 46);
    // pans hanging up, and a pot on the go
    g.fillStyle = "#555";
    for (const x of [130, 200, 360]) {
      g.fillRect(x - 2, 70, 4, 30);
      g.beginPath();
      g.arc(x, 118, 20, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = "#b5b5b5";
    g.fillRect(250, 150, 80, 48);
    g.strokeStyle = "rgba(255,255,255,0.7)";
    g.lineWidth = 6;
    g.lineCap = "round";
    for (const x of [270, 310]) {
      g.beginPath();
      g.moveTo(x, 145);
      g.bezierCurveTo(x - 14, 125, x + 14, 110, x, 88);
      g.stroke();
    }
  });
}

/** How far the pendants hang below the ceiling: high enough to keep out of the way of the sign. */
const CORD = 0.62;

/** Red pendant lamps over the table: the middle one lights it and casts the shadows. */
export function pendants(anchor: Anchor) {
  const g = new THREE.Group();
  g.position.set(anchor.position.x, anchor.position.y, anchor.position.z);
  const shadeMat = new THREE.MeshStandardMaterial({
    color: RED,
    side: THREE.DoubleSide,
    roughness: 0.35,
    metalness: 0.2,
  });
  const bulbMat = new THREE.MeshStandardMaterial({ color: "#fff6d8", emissive: "#ffe0a0", emissiveIntensity: 4 });
  const cordMat = toon("#222");
  const shine = chrome();
  const drops = [-1.25, 0, 1.25];
  const lamps: THREE.Group[] = [];
  for (const x of drops) {
    const lamp = new THREE.Group();
    lamp.position.x = x;
    const len = CORD;
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, len), cordMat);
    cord.position.y = -len / 2;
    const shade = new THREE.Mesh(new THREE.SphereGeometry(0.26, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), shadeMat);
    shade.scale.y = 0.75;
    shade.position.y = -len - 0.18;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.265, 0.265, 0.03, 20, 1, true), shine);
    band.position.y = -len - 0.18;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.06, 10), shine);
    cap.position.y = -len + 0.02;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), bulbMat);
    bulb.position.y = -len - 0.2;
    lamp.add(cord, shade, band, cap, bulb);
    lamps.push(lamp);
    g.add(lamp);
  }
  const drop = CORD + 0.22;
  const spot = new THREE.SpotLight("#ffe2b0", 14, 0, 0.95, 0.65, 1.1);
  spot.position.y = -drop;
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.bias = -0.0005;
  spot.shadow.camera.near = 0.2;
  const target = new THREE.Object3D();
  target.position.y = -3;
  spot.target = target;
  // a soft red-tinted glow from all three, so the shades read as lit
  const glow = new THREE.PointLight("#ffb0a0", 1.4, 5, 1.6);
  glow.position.y = -drop + 0.05;
  g.add(spot, target, glow);
  return {
    object: g,
    update(t: number) {
      lamps.forEach((l, i) => (l.rotation.z = Math.sin(t * 0.6 + i * 1.3) * 0.02));
    },
  };
}
