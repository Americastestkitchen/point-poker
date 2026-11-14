// Async Atoll's easter eggs, each one clickable: a laptop on a beach chair that
// auto-replies, a wifi sign with one bar (until you click it), a message in a
// bottle, a crab with a "scope creep" flag, and a gull that ran off with a sticky note.
import * as THREE from "three";
import { toon } from "../../scene/art/materials.ts";
import { FONT, canvasTex } from "../../scene/art/textures.ts";
import { popup } from "../kit/bubble.ts";
import { box, cylinder, plane, put, sphere } from "../kit/build.ts";
import { lettering, liveCanvas } from "../kit/canvas.ts";
import type { EnvCtx } from "../types.ts";
import { SHORE_X } from "./shore.ts";
import { stripesTexture } from "./textures.ts";

export function eggs(ctx: EnvCtx): THREE.Group {
  const g = new THREE.Group();
  g.add(laptopChair(ctx), wifiSign(ctx), bottle(ctx), crab(ctx), gull(ctx));
  return g;
}

/** Turns `o` (already placed) to face the middle of the table. */
const faceTable = (o: THREE.Object3D) => o.lookAt(0, o.position.y, 0);

/** A beach chair with a laptop on it, auto-replying to everyone. Click it to send one more. */
function laptopChair({ pick, onFrame, sound }: EnvCtx): THREE.Group {
  const g = put(new THREE.Group(), -2.9, 0, -3.9);
  faceTable(g);
  const frame = toon("#d8d0c0");
  const fabric = toon("#ffffff", { map: stripesTexture("#3fa7a3", "#f3e6c8", 6), side: THREE.DoubleSide });
  const seat = put(plane(0.55, 0.6, fabric), 0, 0.32, 0);
  seat.rotation.x = -Math.PI / 2 + 0.15;
  const back = put(plane(0.55, 0.75, fabric), 0, 0.62, -0.42);
  back.rotation.x = -0.45;
  for (const s of [-1, 1]) {
    const leg = put(cylinder(0.015, 0.015, 1.05, frame, 6), s * 0.28, 0.45, -0.18);
    leg.rotation.x = 0.75;
    const front = put(cylinder(0.015, 0.015, 0.42, frame, 6), s * 0.28, 0.2, 0.22);
    front.rotation.x = -0.4;
    g.add(leg, front);
  }
  g.add(seat, back);

  const laptop = put(new THREE.Group(), 0, 0.36, 0.05);
  laptop.rotation.x = 0.15;
  const base = box(0.34, 0.02, 0.24, toon("#9aa3ad"));
  const screen = liveCanvas(256, 160);
  const lid = put(box(0.34, 0.22, 0.012, toon("#9aa3ad")), 0, 0.11, -0.12);
  lid.rotation.x = -0.25;
  lid.add(put(plane(0.31, 0.19, new THREE.MeshBasicMaterial({ map: screen.texture })), 0, 0, 0.007));
  laptop.add(base, lid);
  g.add(laptop);

  const draw = (sent: boolean) => {
    screen.g.fillStyle = sent ? "#e8fff0" : "#eaf4ff";
    screen.g.fillRect(0, 0, 256, 160);
    lettering(
      screen.g,
      sent
        ? [
            ["✓ Auto-reply sent", 26, "#1f7a43"],
            ["to: everyone", 18, "#35505a"],
            ["(they're also here)", 18, "#35505a"],
          ]
        : [
            ["OUT OF OFFICE", 28, "#c0392b"],
            ["back: eventually", 18, "#35505a"],
            ["🌴 replies may be async", 16, "#35505a"],
          ],
    );
    screen.redraw();
  };
  draw(false);
  let sentFor = 0;
  pick(g, () => {
    sentFor = 4;
    draw(true);
    sound.tone(880, 0.12, "sine", 0.1);
    sound.tone(1320, 0.18, "sine", 0.08, undefined, 0.1);
  });
  onFrame((dt) => {
    if (sentFor <= 0) return;
    sentFor -= dt;
    if (sentFor <= 0) draw(false);
  });
  return g;
}

/** "FREE WIFI" on a stake, with one bar. Click it and that bar goes too. */
function wifiSign({ pick, onFrame, sound }: EnvCtx): THREE.Group {
  const g = put(new THREE.Group(), -6.6, 0, 2.6);
  faceTable(g);
  const stake = put(cylinder(0.03, 0.03, 1.5, toon("#8a6440"), 6), 0, 0.75, 0);
  const board = liveCanvas(256, 192);
  const face = put(plane(0.6, 0.45, new THREE.MeshBasicMaterial({ map: board.texture })), 0, 1.45, 0.035);
  const back = put(box(0.64, 0.49, 0.06, toon("#b08a5a")), 0, 1.45, 0);
  g.add(stake, back, face);

  const draw = (bars: number) => {
    const c = board.g;
    c.fillStyle = "#f6ead0";
    c.fillRect(0, 0, 256, 192);
    c.fillStyle = "#2c6f7a";
    c.font = `bold 34px ${FONT}`;
    c.textAlign = "center";
    c.fillText(bars ? "FREE WIFI" : "NO WIFI", 128, 46);
    for (let i = 0; i < 4; i++) {
      c.fillStyle = i < bars ? "#2c6f7a" : "rgba(44,111,122,0.18)";
      c.fillRect(70 + i * 30, 150 - i * 22, 22, 22 + i * 22);
    }
    c.font = `20px ${FONT}`;
    c.fillText(bars ? "(1 bar, on a good day)" : "touch grass instead", 128, 178);
    board.redraw();
  };
  draw(1);
  let offFor = 0;
  pick(g, () => {
    offFor = 6;
    draw(0);
    sound.tone(660, 0.25, "triangle", 0.1, 220);
  });
  onFrame((dt) => {
    if (offFor <= 0) return;
    offFor -= dt;
    if (offFor <= 0) draw(1);
  });
  return g;
}

/** A message in a bottle drifting along the shore. Click it to read it. */
function bottle({ pick, onFrame, sound }: EnvCtx): THREE.Group {
  const g = new THREE.Group();
  const glass = new THREE.MeshStandardMaterial({
    color: "#7fd1b0",
    transparent: true,
    opacity: 0.75,
    roughness: 0.1,
  });
  const body = cylinder(0.09, 0.09, 0.36, glass, 10);
  const neck = put(cylinder(0.035, 0.07, 0.14, glass, 10), 0, 0.24, 0);
  const cork = put(cylinder(0.03, 0.03, 0.05, toon("#a0703a"), 8), 0, 0.33, 0);
  const scroll = cylinder(0.04, 0.04, 0.24, toon("#f3e3c0"), 8);
  const bobber = new THREE.Group();
  bobber.add(body, neck, cork, scroll);
  bobber.rotation.z = Math.PI / 2.4;
  g.add(bobber);

  const note = popup(
    g,
    canvasTex(512, 256, (c) => {
      c.fillStyle = "#f6ead0";
      c.fillRect(0, 0, 512, 256);
      c.strokeStyle = "#c8b48a";
      c.lineWidth = 10;
      c.strokeRect(5, 5, 502, 246);
      lettering(c, [
        ["pls estimate me", 54, "#3a2618"],
        ["— a ticket, lost at sea since sprint 3", 24, "#6b4a2e"],
      ]);
    }),
    { width: 2.2, height: 1.1, y: 1.4, seconds: 5, fadeIn: 0.25, fadeOut: 0.5 },
  );

  pick(bobber, () => {
    note.show();
    sound.tone(500, 0.08, "square", 0.06, 1400);
    sound.noise(0.12, 2500, 0.08, 0.05);
  });
  onFrame((dt, t) => {
    const drift = ((t * 0.35) % 36) - 18; // along the shore, end to end
    g.position.set(SHORE_X + 2.2, 0.12 + Math.sin(t * 1.3) * 0.06, drift);
    bobber.rotation.x = Math.sin(t * 0.9) * 0.3;
    if (note.update(dt)) note.mesh.lookAt(0, g.position.y + note.mesh.position.y, 0);
  });
  return g;
}

/** A crab sidling up and down the sand with a "SCOPE CREEP" flag. Click it and it scuttles off. */
function crab({ pick, onFrame, sound }: EnvCtx): THREE.Group {
  const g = new THREE.Group();
  const red = toon("#e4573d");
  const shell = put(sphere(0.16, red, 12, 8), 0, 0.12, 0);
  shell.scale.set(1.3, 0.55, 1);
  g.add(shell);
  for (const s of [-1, 1]) {
    const claw = put(sphere(0.06, red, 8, 6), s * 0.2, 0.14, 0.15);
    claw.scale.set(1.2, 0.8, 0.8);
    const stalk = put(cylinder(0.01, 0.01, 0.1, red, 4), s * 0.05, 0.22, 0.1);
    const eye = put(sphere(0.022, toon("#111"), 8, 6), s * 0.05, 0.28, 0.1);
    g.add(claw, stalk, eye);
    for (let i = 0; i < 3; i++) {
      const leg = put(cylinder(0.012, 0.012, 0.2, red, 4), s * 0.2, 0.06, -0.08 + i * 0.07);
      leg.rotation.z = s * 1.0;
      g.add(leg);
    }
  }
  const pole = put(cylinder(0.008, 0.008, 0.5, toon("#ddd"), 4), 0, 0.4, -0.06);
  const flagMat = new THREE.MeshBasicMaterial({
    side: THREE.DoubleSide,
    map: canvasTex(256, 120, (c) => {
      c.fillStyle = "#fff4e0";
      c.fillRect(0, 0, 256, 120);
      lettering(c, [
        ["SCOPE", 44, "#c0392b"],
        ["CREEP", 44, "#c0392b"],
      ]);
    }),
  });
  const flag = put(plane(0.34, 0.16, flagMat), 0.17, 0.58, -0.06);
  g.add(pole, flag);
  g.rotation.y = Math.PI; // claws towards the table; crabs walk sideways anyway
  g.traverse((o) => {
    o.castShadow = o instanceof THREE.Mesh;
  });

  let x = 0;
  let dir = 1;
  let rush = 0;
  pick(g, () => {
    rush = 2.5;
    dir = -dir;
    for (let i = 0; i < 4; i++) sound.noise(0.03, 4500, 0.08, i * 0.06);
  });
  onFrame((dt, t) => {
    rush = Math.max(0, rush - dt);
    // sidle a bit, stop and think, sidle a bit more
    const moving = rush > 0 || Math.sin(t * 0.8) > -0.2;
    const speed = rush > 0 ? 1.6 : 0.35;
    if (moving) x += dir * speed * dt;
    if (Math.abs(x) > 3.5) dir = -Math.sign(x);
    g.position.set(x, moving ? Math.abs(Math.sin(t * 18)) * 0.015 : 0, 3.7);
    flag.rotation.y = Math.sin(t * 3) * 0.25;
  });
  return g;
}

/** A gull circling overhead with somebody's sticky note in its beak. Click it for a squawk. */
function gull({ pick, onFrame, sound }: EnvCtx): THREE.Group {
  const g = new THREE.Group();
  const white = toon("#f4f4f0");
  const body = sphere(0.14, white, 10, 8);
  body.scale.set(1, 0.8, 2);
  const head = put(sphere(0.08, white, 10, 8), 0, 0.07, 0.24);
  const beak = put(new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.1, 6), toon("#f2b33d")), 0, 0.06, 0.34);
  beak.rotation.x = Math.PI / 2;
  const noteMat = new THREE.MeshBasicMaterial({
    side: THREE.DoubleSide,
    map: canvasTex(128, 128, (c) => {
      c.fillStyle = "#ffd23f";
      c.fillRect(0, 0, 128, 128);
      lettering(c, [
        ["TODO:", 26, "#2a1d17"],
        ["estimate", 22, "#2a1d17"],
      ]);
    }),
  });
  const note = put(plane(0.16, 0.16, noteMat), 0, -0.04, 0.42);
  const wingMat = toon("#d9dcdf", { side: THREE.DoubleSide });
  const wings = [-1, 1].map((s) => {
    const pivot = put(new THREE.Group(), s * 0.08, 0.04, 0);
    const wing = put(plane(0.55, 0.22, wingMat), s * 0.27, 0, 0);
    wing.rotation.x = -Math.PI / 2;
    pivot.add(wing);
    return { pivot, s };
  });
  g.add(body, head, beak, note, ...wings.map((w) => w.pivot));

  let squawk = 0;
  pick(g, () => {
    squawk = 1.5;
    sound.tone(1600, 0.16, "sawtooth", 0.05, 900);
    sound.tone(1500, 0.2, "sawtooth", 0.045, 800, 0.18);
  });
  let a = 0;
  onFrame((dt, t) => {
    squawk = Math.max(0, squawk - dt);
    a += dt * (squawk > 0 ? 0.5 : 0.18);
    g.position.set(Math.cos(a) * 6.5, 4.6 + Math.sin(t * 0.7) * 0.3, Math.sin(a) * 6.5);
    g.rotation.set(0, -a, 0.25); // nose along the circle, banking in
    const flap = Math.sin(t * (squawk > 0 ? 16 : 5)) * 0.5;
    for (const w of wings) w.pivot.rotation.z = w.s * flap;
  });
  return g;
}
