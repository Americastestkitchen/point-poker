// Things to click around the Basement: sticky notes that fall off the corkboard
// (and get replaced, the backlog always grows), the whiteboard's mystery fourth
// goal, the server rack that is definitely fine, the sad plant that wants
// water, and the door nobody uses, which is locked.
import * as THREE from "three";
import { toon } from "../../scene/art/materials.ts";
import { FONT, canvasTex, woodTexture } from "../../scene/art/textures.ts";
import { wobble } from "../kit/animate.ts";
import { bubble } from "../kit/bubble.ts";
import { liveCanvas, speckle } from "../kit/canvas.ts";
import type { EnvCtx } from "../types.ts";

export function eggs(ctx: EnvCtx): THREE.Group {
  const g = new THREE.Group();
  g.add(corkboard(ctx), whiteboard(ctx), serverRack(ctx), sadPlant(ctx), lockedDoor(ctx));
  return g;
}

const SCRAWL = `"Comic Sans MS", ${FONT}`;
const NOTE_COLORS = ["#ffd23f", "#ff9ec7", "#8ce05a", "#4ad6ff"];
const FIRST_NOTES = [
  "it's just\na button",
  "WON'T\nFIX",
  "estimate:\nvibes",
  "who\nwrote this",
  "works on\nmy machine",
  "5 min\ntask",
  "blocked by\nlegal",
  "TODO:\nsleep",
];
/** What turns up in place of a note that fell off. */
const NEW_NOTES = [
  "needs more\ncontext",
  "out of\nscope",
  "per my last\nnote",
  "tech debt\n(later)",
  "just one\nmore thing",
  "blocked by\nthis note",
  "LGTM",
  "quick\nwin?",
  "ask\nsomeone",
  "spike it",
];

/** One sticky note, with its pin and a soft shadow, on a canvas with room round it for the shadow. */
function noteTexture(text: string, color: string): THREE.CanvasTexture {
  return canvasTex(176, 176, (g) => {
    g.fillStyle = "rgba(0,0,0,0.3)";
    g.fillRect(22, 24, 140, 140);
    g.fillStyle = color;
    g.fillRect(14, 14, 140, 140);
    g.fillStyle = "#c0392b";
    g.beginPath();
    g.arc(84, 26, 8, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#2a1d17";
    g.font = `bold 24px ${SCRAWL}`;
    g.textAlign = "center";
    text.split("\n").forEach((l, k) => g.fillText(l, 84, 74 + k * 30));
  });
}

/**
 * The corkboard of sticky-note wisdom. Click a note and it comes unpinned and
 * flutters to the floor; a few seconds later a new one is pinned in its place.
 */
function corkboard({ pick, onFrame, sound }: EnvCtx): THREE.Group {
  const W = 2.1,
    H = 1.4;
  const g = new THREE.Group();
  g.position.set(-1.6, 1.8, -3.98);
  const cork = new THREE.Mesh(
    new THREE.PlaneGeometry(W, H),
    new THREE.MeshStandardMaterial({
      roughness: 1,
      map: canvasTex(768, 512, (c) => {
        c.fillStyle = "#8a6038";
        c.fillRect(0, 0, 768, 512);
        speckle(c, 4000, 3, () => `rgba(40,20,5,${Math.random() * 0.25})`);
        c.strokeStyle = "#3a2414";
        c.lineWidth = 24;
        c.strokeRect(0, 0, 768, 512);
      }),
    }),
  );
  g.add(cork);
  const say = bubble(g, 1.3, 1.0);

  const size = (176 / 768) * W; // the note canvas, at the board's scale
  let fresh = 0;
  const notes = FIRST_NOTES.map((text, i) => {
    // where the old corkboard drew them, from its 768 × 512 canvas
    const cx = 60 + (i % 4) * 172 + Math.random() * 20 + 70;
    const cy = 50 + Math.floor(i / 4) * 220 + Math.random() * 20 + 70;
    const home = new THREE.Vector3((cx / 768 - 0.5) * W, (0.5 - cy / 512) * H, 0.01 + i * 0.001);
    const tilt = (Math.random() - 0.5) * 0.3;
    const mat = new THREE.MeshStandardMaterial({
      map: noteTexture(text, NOTE_COLORS[i % NOTE_COLORS.length] ?? "#ffd23f"),
      transparent: true,
      roughness: 0.9,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
    mesh.position.copy(home);
    mesh.rotation.z = tilt;
    g.add(mesh);
    const note = { mesh, mat, home, tilt, color: i % NOTE_COLORS.length, falling: -1, gone: 0 };
    pick(mesh, () => {
      if (note.falling >= 0) return;
      note.falling = 0;
      sound.noise(0.25, 5000, 0.08);
      if (Math.random() < 0.4) say.say("the backlog always grows", "#2a1d17");
    });
    return note;
  });

  const repin = (note: (typeof notes)[number]) => {
    note.mat.map?.dispose();
    note.color = (note.color + 1) % NOTE_COLORS.length;
    note.mat.map = noteTexture(NEW_NOTES[fresh++ % NEW_NOTES.length] ?? "", NOTE_COLORS[note.color] ?? "#ffd23f");
    note.mat.opacity = 1;
    note.mesh.position.copy(note.home);
    note.mesh.rotation.set(0, 0, note.tilt);
    note.mesh.scale.setScalar(0.01);
    note.falling = -1;
    note.gone = 0;
    sound.tone(900, 0.06, "square", 0.04, 1300);
  };

  onFrame((dt, t) => {
    say.update(dt);
    for (const note of notes) {
      const { mesh } = note;
      if (mesh.scale.x < 1) mesh.scale.setScalar(Math.min(1, mesh.scale.x + dt * 5)); // a new one popping in
      if (note.falling < 0) continue;
      note.falling += dt;
      if (mesh.position.z < 0.6) {
        // flutter down and out from the wall, rocking side to side, to land flat on the floor
        mesh.position.z += dt * 0.35;
        mesh.position.x = note.home.x + Math.sin(note.falling * 4) * 0.12;
        mesh.position.y = Math.max(-1.79, mesh.position.y - dt * 0.9);
        mesh.rotation.set(-note.falling * 0.9, 0, note.tilt + Math.sin(note.falling * 5 + t) * 0.6);
      } else if (mesh.position.y > -1.79) {
        mesh.position.y = Math.max(-1.79, mesh.position.y - dt * 0.9);
      } else {
        mesh.rotation.set(-Math.PI / 2, 0, note.tilt);
        note.gone += dt;
        note.mat.opacity = Math.max(0, 1 - Math.max(0, note.gone - 2.5));
        if (note.gone > 4) repin(note);
      }
    }
  });
  return g;
}

/** What else the sprint was going to do. */
const FOURTH_GOALS = [
  "4. ???",
  "4. profit",
  "4. rewrite it in Rust",
  "4. one more meeting",
  "4. fix the burndown",
  "4. touch grass",
  "4. ??? (again)",
];

/** The whiteboard of sprint goals. Click it and someone has another go at goal four. */
function whiteboard({ pick, onFrame, sound }: EnvCtx): THREE.Group {
  const g = new THREE.Group();
  g.position.set(1.4, 1.75, 3.98);
  g.rotation.y = Math.PI;
  const board = liveCanvas(768, 512);
  let goal = 0;
  const draw = () => {
    const c = board.g;
    c.fillStyle = "#e9ece8";
    c.fillRect(0, 0, 768, 512);
    c.strokeStyle = "#9aa1a6";
    c.lineWidth = 20;
    c.strokeRect(0, 0, 768, 512);
    c.font = `bold 50px ${SCRAWL}`;
    c.fillStyle = "#1f4fbf";
    c.textAlign = "left";
    c.fillText("SPRINT GOALS", 50, 90);
    c.font = `36px ${SCRAWL}`;
    c.fillStyle = "#222";
    ["1. ship it", '2. don\'t say "should be quick"', "3. stop pointing in hours"].forEach((l, i) =>
      c.fillText(l, 60, 170 + i * 66),
    );
    c.fillStyle = goal ? "#1f7a43" : "#222";
    c.fillText(FOURTH_GOALS[goal] ?? "4. ???", 60, 170 + 3 * 66);
    c.strokeStyle = "#c0392b";
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(56, 222);
    c.lineTo(680, 222);
    c.stroke();
    c.fillStyle = "#c0392b";
    c.font = `bold 40px ${SCRAWL}`;
    c.fillText("velocity ↗ (allegedly)", 330, 470);
    board.redraw();
  };
  draw();
  const wb = new THREE.Mesh(
    new THREE.PlaneGeometry(2.0, 1.33),
    new THREE.MeshStandardMaterial({ map: board.texture, roughness: 0.5 }),
  );
  g.add(wb);
  const say = bubble(g, 1.2, 0.95);
  pick(wb, () => {
    goal = (goal + 1) % FOURTH_GOALS.length;
    draw();
    // a dry-erase marker squeaking
    sound.tone(2400, 0.12, "sawtooth", 0.02, 3000);
    sound.tone(2600, 0.1, "sawtooth", 0.02, 2200, 0.14);
    if (goal === 0) say.say("back to ???", "#1f4fbf");
  });
  onFrame((dt) => say.update(dt));
  return g;
}

/** The server rack with its blinkenlights. Click it and everything goes red, but it's fine. */
function serverRack({ pick, onFrame, sound }: EnvCtx): THREE.Group {
  const rack = new THREE.Group();
  rack.position.set(4.4, 0, -3.4);
  rack.rotation.y = -Math.PI / 4;
  const cab = new THREE.Mesh(
    new THREE.BoxGeometry(0.75, 2.0, 0.7),
    new THREE.MeshStandardMaterial({ color: "#16161b", roughness: 0.6, metalness: 0.4 }),
  );
  cab.position.y = 1.0;
  cab.castShadow = true;
  rack.add(cab);
  const slabMat = new THREE.MeshStandardMaterial({ color: "#26262e", roughness: 0.5 });
  const leds: { mat: THREE.MeshBasicMaterial; rate: number; on: string }[] = [];
  for (let u = 0; u < 9; u++) {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.15, 0.02), slabMat);
    slab.position.set(0, 0.25 + u * 0.19, 0.36);
    rack.add(slab);
    for (let l = 0; l < 4; l++) {
      const on = ["#39ff7a", "#ffb02e", "#39c2ff", "#ff4757"][(u + l) % 4] ?? "#39ff7a";
      const mat = new THREE.MeshBasicMaterial({ color: on });
      const led = new THREE.Mesh(new THREE.PlaneGeometry(0.018, 0.018), mat);
      led.position.set(0.18 + l * 0.03, 0.25 + u * 0.19, 0.372);
      rack.add(led);
      leds.push({ mat, rate: 0.5 + Math.random() * 6, on });
    }
  }
  const light = new THREE.PointLight("#39ff7a", 0.8, 2.5, 2);
  light.position.set(0, 1.2, 0.6);
  rack.add(light);
  const say = bubble(rack, 1.1, 2.35);
  const shake = wobble(40, 4);

  let panic = 0;
  pick(rack, () => {
    if (panic > 0) return;
    panic = 3;
    shake.kick(0.02);
    say.say("this is fine", "#c0392b");
    // the fans spin up
    sound.tone(180, 1.6, "sawtooth", 0.025, 900);
    sound.noise(1.4, 3000, 0.04);
  });
  onFrame((dt, t) => {
    say.update(dt);
    panic = Math.max(0, panic - dt);
    cab.position.x = shake.step(dt);
    for (const l of leds) {
      const blink = Math.sin(t * (panic > 0 ? l.rate * 4 + 10 : l.rate) + l.rate * 10) > 0;
      l.mat.color.set(blink ? (panic > 0 ? "#ff2a3a" : l.on) : "#111");
    }
    light.color.set(panic > 0 ? "#ff3040" : "#39ff7a");
  });
  return rack;
}

/** A crate with a sad office plant. Water it (click) and it perks up, for a bit. */
function sadPlant({ pick, onFrame, sound }: EnvCtx): THREE.Group {
  const g = new THREE.Group();
  g.position.set(-4.3, 0, -3.3);
  g.rotation.y = Math.PI / 4; // its bubble faces into the room
  const crate = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.5, 0.6),
    new THREE.MeshStandardMaterial({ map: woodTexture("#6b4a2a", "#3a2414", 1), roughness: 0.9 }),
  );
  crate.position.y = 0.25;
  crate.castShadow = true;
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.25, 16), toon("#b0603a"));
  pot.position.y = 0.62;
  g.add(crate, pot);
  const leaves = Array.from({ length: 7 }, (_, i) => {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), toon(i % 2 ? "#3e7a3a" : "#5f8f3a"));
    leaf.scale.set(0.5, 1.6, 0.25);
    const a = (i / 7) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 0.08, 0.86, Math.sin(a) * 0.08);
    const droop = new THREE.Euler(Math.sin(a) * 0.6 + 0.4, 0, -Math.cos(a) * 0.6);
    leaf.rotation.copy(droop);
    g.add(leaf);
    return { leaf, droop };
  });
  const say = bubble(g, 0.9, 1.45);

  let perk = 0; // 0 sad, 1 thriving
  let happyFor = 0;
  pick(g, () => {
    happyFor = 4;
    say.say("thank you!!", "#3e7a3a");
    // glug glug
    for (let i = 0; i < 3; i++) sound.tone(320 - i * 40, 0.12, "sine", 0.08, 180, i * 0.14);
  });
  onFrame((dt) => {
    say.update(dt);
    const was = happyFor;
    happyFor = Math.max(0, happyFor - dt);
    if (was > 0 && happyFor === 0) say.say("...still sad", "#5a5048");
    perk += ((happyFor > 0 ? 1 : 0) - perk) * Math.min(1, dt * (happyFor > 0 ? 6 : 0.8));
    for (const { leaf, droop } of leaves) {
      leaf.rotation.set(droop.x * (1 - perk * 0.8), 0, droop.z * (1 - perk * 0.8));
      leaf.position.y = 0.86 + perk * 0.06;
    }
  });
  return g;
}

/** The door nobody uses, under its EXIT? sign. Click it: it's locked. */
function lockedDoor({ pick, onFrame, sound }: EnvCtx): THREE.Group {
  const g = new THREE.Group();
  g.position.set(-3.4, 0, 3.97);
  g.rotation.y = Math.PI; // facing into the room
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 2.1, 0.06),
    new THREE.MeshStandardMaterial({ map: woodTexture("#3b2a20", "#20140c", 1), roughness: 0.8 }),
  );
  door.position.y = 1.05;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), toon("#c9a24a"));
  knob.position.set(0.38, 1.0, 0.05);
  const signMat = new THREE.MeshBasicMaterial({
    map: canvasTex(256, 90, (c) => {
      c.fillStyle = "#0d3";
      c.fillRect(0, 0, 256, 90);
      c.fillStyle = "#eaffea";
      c.font = `bold 60px ${FONT}`;
      c.textAlign = "center";
      c.fillText("EXIT?", 128, 68);
    }),
  });
  const exit = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.14), signMat);
  exit.position.set(0, 2.32, 0.01);
  const light = new THREE.PointLight("#22ff66", 0.6, 2, 2);
  light.position.set(0, 2.2, 0.27);
  g.add(door, knob, exit, light);
  const say = bubble(g, 1.3, 2.75);
  const rattle = wobble(45, 5);
  const LINES = ["it's locked", "there is no exit", "only more backlog"];
  let tries = 0;
  let flicker = 0;
  pick(g, () => {
    rattle.kick(0.012);
    say.say(LINES[tries++ % LINES.length] ?? "", "#1f7a43");
    flicker = 0.8;
    // knock knock, then the handle won't turn
    sound.noise(0.06, 400, 0.25);
    sound.noise(0.06, 400, 0.25, 0.18);
    sound.tone(140, 0.12, "square", 0.05, 120, 0.4);
  });
  onFrame((dt) => {
    say.update(dt);
    const r = rattle.step(dt);
    door.position.x = r;
    knob.position.x = 0.38 + r;
    knob.rotation.z = r * 20;
    flicker = Math.max(0, flicker - dt);
    const on = flicker === 0 || Math.random() < 0.5;
    signMat.color.set(on ? "#ffffff" : "#333333");
    light.intensity = on ? 0.6 : 0.1;
  });
  return g;
}
