// Things around the diner to click: the specials board, the hotfix counter,
// the order bell, the pie case with the last slice and the jukebox that only
// knows one song. Each one wiggles, makes a noise and says something.
import * as THREE from "three";
import { toon } from "../../scene/art/materials.ts";
import { FONT, canvasTex } from "../../scene/art/textures.ts";
import { wobble } from "../kit/animate.ts";
import { bubble } from "../kit/bubble.ts";
import { liveCanvas } from "../kit/canvas.ts";
import type { EnvCtx } from "../types.ts";
import { chrome, ROOM } from "./room.ts";
import { RED, TEAL } from "./textures.ts";

/** Puts an egg against the wall at x = -5 (behind the dealer), facing into the room. */
function onBackWall(o: THREE.Object3D, z: number, y: number) {
  o.position.set(-ROOM.x + 0.03, y, z);
  o.rotation.y = Math.PI / 2;
}
/** Puts an egg against the wall at x = +5 (behind the sign), facing the dealer. */
function onFarWall(o: THREE.Object3D, z: number, y: number) {
  o.position.set(ROOM.x - 0.03, y, z);
  o.rotation.y = -Math.PI / 2;
}

const SPECIALS = [
  ["Spaghetti Code", "5.99"],
  ["Full Stack Pancakes", "8.99"],
  ["Cold Cache Brew", "0.99"],
  ["Hash Collision", "6.49"],
] as const;
const CHEF_SAYS = ["Chef's pick!", "Ooh, good choice", "Comes with tests (no)", "Hot from the oven"];

/** The chalkboard of specials. Click it and chef circles one. */
export function specialsBoard(s: THREE.Group, { pick, onFrame, sound }: EnvCtx) {
  const g = new THREE.Group();
  onBackWall(g, -2.55, 1.95);
  const W = 512,
    H = 448;
  const c = liveCanvas(W, H);
  let chosen = -1;
  const draw = () => {
    const x = c.g;
    x.fillStyle = "#24282a";
    x.fillRect(0, 0, W, H);
    x.fillStyle = "rgba(255,255,255,0.04)";
    for (let i = 0; i < 30; i++) x.fillRect(Math.random() * W, Math.random() * H, 80, 3);
    x.textAlign = "center";
    x.fillStyle = "#ffe66b";
    x.font = `bold 46px ${FONT}`;
    x.fillText("TODAY'S SPECIALS", W / 2, 66);
    x.font = `34px ${FONT}`;
    SPECIALS.forEach(([name, price], i) => {
      const y = 140 + i * 70;
      x.fillStyle = "#f4f4ee";
      x.textAlign = "left";
      x.fillText(name, 36, y, 360);
      x.textAlign = "right";
      x.fillText(price, W - 36, y);
      if (i === chosen) {
        x.strokeStyle = "#ffe66b";
        x.lineWidth = 5;
        x.beginPath();
        x.ellipse(W / 2, y - 12, W / 2 - 14, 32, -0.02, 0, Math.PI * 2);
        x.stroke();
      }
    });
    x.textAlign = "center";
    x.fillStyle = "#9fe0c4";
    x.font = `italic 28px ${FONT}`;
    x.fillText("ask about our rollback policy", W / 2, H - 30);
    c.redraw();
  };
  draw();
  const board = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.31), new THREE.MeshBasicMaterial({ map: c.texture }));
  board.position.z = 0.03;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.64, 1.45, 0.05), toon("#8a5a2b"));
  const swing = new THREE.Group(); // hangs from a nail at the top
  swing.position.y = 0.72;
  board.position.y = frame.position.y = -0.72;
  swing.add(frame, board);
  g.add(swing);
  const say = bubble(g, 1.6, 1.0);
  const wob = wobble(9, 2.5);
  pick(g, () => {
    chosen = (chosen + 1) % SPECIALS.length;
    draw();
    wob.kick(0.06);
    const special = SPECIALS[chosen];
    say.say(`${CHEF_SAYS[chosen % CHEF_SAYS.length] ?? ""} ${special ? special[0] : ""}`, "#2b2b2b");
    // chalk on a board: two little squeaks
    sound.tone(2600, 0.09, "sawtooth", 0.018, 3100);
    sound.tone(2300, 0.12, "sawtooth", 0.018, 2900, 0.12);
  });
  onFrame((dt) => {
    swing.rotation.z = wob.step(dt);
    say.update(dt);
  });
  s.add(g);
}

/** "Days since last hotfix: 0". Click it and it makes it to 1, briefly. */
export function hotfixSign(s: THREE.Group, { pick, onFrame, sound }: EnvCtx) {
  const g = new THREE.Group();
  onFarWall(g, 2.5, 1.9);
  const W = 320,
    H = 256;
  const c = liveCanvas(W, H);
  const draw = (days: number) => {
    const x = c.g;
    x.fillStyle = "#fffdf4";
    x.fillRect(0, 0, W, H);
    x.strokeStyle = "#333";
    x.lineWidth = 10;
    x.strokeRect(5, 5, W - 10, H - 10);
    x.fillStyle = "#333";
    x.textAlign = "center";
    x.font = `bold 30px ${FONT}`;
    x.fillText("DAYS SINCE", W / 2, 50);
    x.fillText("LAST HOTFIX", W / 2, 86);
    x.fillStyle = days ? TEAL : RED;
    x.font = `bold 130px ${FONT}`;
    x.fillText(String(days), W / 2, 216);
    c.redraw();
  };
  draw(0);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.72), new THREE.MeshBasicMaterial({ map: c.texture }));
  sign.position.z = 0.02;
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.78, 0.03), toon("#333"));
  g.add(back, sign);
  const say = bubble(g, 1.4, 0.72);
  const shake = wobble(30, 3);
  /** Seconds until prod breaks again; negative when it already has. */
  let calm = -1;
  pick(g, () => {
    if (calm > 0) return;
    draw(1);
    calm = 1.1;
    say.say("A whole day!", TEAL);
    sound.tone(660, 0.12, "triangle", 0.06);
    sound.tone(990, 0.2, "triangle", 0.06, undefined, 0.1);
  });
  onFrame((dt) => {
    if (calm > 0) {
      calm -= dt;
      if (calm <= 0) {
        draw(0);
        shake.kick(0.05);
        say.say("...prod is down", RED);
        // the pager
        for (let i = 0; i < 3; i++) sound.tone(1250, 0.09, "square", 0.03, undefined, i * 0.15);
        sound.tone(300, 0.5, "sawtooth", 0.03, 140, 0.5);
      }
    }
    g.rotation.z = shake.step(dt);
    say.update(dt);
  });
  s.add(g);
}

/** The order bell on the kitchen pass. Ding! */
export function orderBell(s: THREE.Group, { pick, onFrame, sound, anchors }: EnvCtx) {
  const g = new THREE.Group();
  // on the pass shelf, to the right of the order slip (as the dealer turns round)
  g.position.set(-ROOM.x + 0.25, 1.18, anchors.statusScreen.position.z - 1.0);
  g.rotation.y = Math.PI / 2;
  g.scale.setScalar(1.6);
  const brass = new THREE.MeshStandardMaterial({ color: "#e0b24a", metalness: 0.6, roughness: 0.25 });
  const shine = chrome();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.08, 0.025, 16), toon("#2a2a2a"));
  base.position.y = 0.0125;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.065, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), brass);
  dome.position.y = 0.025;
  const plunger = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.04, 6), shine);
  plunger.position.y = 0.105;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), shine);
  knob.position.y = 0.128;
  const press = new THREE.Group();
  press.add(plunger, knob);
  g.add(base, dome, press);
  const say = bubble(g, 0.8, 0.35);
  const ring = wobble(40, 5);
  let pressed = 0;
  pick(g, () => {
    pressed = 1;
    ring.kick(0.12);
    say.say("ORDER UP!", RED);
    sound.tone(2350, 1.4, "sine", 0.1);
    sound.tone(5880, 0.5, "sine", 0.03);
    sound.tone(3530, 0.9, "sine", 0.025);
  });
  onFrame((dt) => {
    pressed = Math.max(0, pressed - dt * 6);
    press.position.y = -pressed * 0.02;
    dome.rotation.z = ring.step(dt);
    say.update(dt);
  });
  s.add(g);
}

/** The pie case on the counter, one cherry slice left, labelled MVP. Eat it and it comes back. */
export function pieCase(s: THREE.Group, { pick, onFrame, sound }: EnvCtx) {
  const g = new THREE.Group();
  g.position.set(-3.0, 1.01, -ROOM.z + 0.4);
  g.scale.setScalar(1.4);
  const shine = chrome();
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.03, 20), shine);
  stand.position.y = 0.015;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.08, 10), shine);
  stem.position.y = 0.06;
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.22, 0.02, 20), toon("#f4f1ea"));
  plate.position.y = 0.11;
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.26, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({
      color: "#dff3ff",
      transparent: true,
      opacity: 0.28,
      roughness: 0.05,
      depthWrite: false,
    }),
  );
  const lid = new THREE.Group();
  lid.position.y = 0.12;
  const handle = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), shine);
  handle.position.y = 0.265;
  lid.add(dome, handle);
  // the slice: a wedge of crust with cherry showing at the sides
  const wedge = new THREE.Shape();
  wedge.moveTo(0, 0);
  wedge.lineTo(0.18, -0.07);
  wedge.quadraticCurveTo(0.2, 0, 0.18, 0.07);
  wedge.closePath();
  const sliceGeo = new THREE.ExtrudeGeometry(wedge, { depth: 0.06, bevelEnabled: false, curveSegments: 4 });
  sliceGeo.rotateX(-Math.PI / 2);
  sliceGeo.translate(-0.09, 0, 0);
  const slice = new THREE.Mesh(sliceGeo, [toon("#e8b468"), toon("#b31b2b")]);
  slice.position.set(0, 0.12, 0.02);
  slice.rotation.y = 0.5;
  const tent = new THREE.Mesh(
    new THREE.PlaneGeometry(0.12, 0.06),
    new THREE.MeshBasicMaterial({
      map: canvasTex(128, 64, (x) => {
        x.fillStyle = "#fff";
        x.fillRect(0, 0, 128, 64);
        x.fillStyle = "#333";
        x.font = `bold 40px ${FONT}`;
        x.textAlign = "center";
        x.fillText("MVP", 64, 48);
      }),
    }),
  );
  tent.position.set(0.02, 0.19, 0.12);
  tent.rotation.x = -0.3;
  g.add(stand, stem, plate, slice, tent, lid);
  const say = bubble(g, 0.8, 0.55);
  /** 0 while the slice sits there; counts up through lift, munch, wait and back. */
  let eaten = -1;
  pick(g, () => {
    if (eaten >= 0) return;
    eaten = 0;
    say.say("MVP shipped. Nom.", RED);
    for (let i = 0; i < 3; i++) sound.noise(0.07, 700 + i * 150, 0.15, 0.25 + i * 0.16);
    sound.tone(520, 0.15, "triangle", 0.04, 780, 0.8);
  });
  onFrame((dt) => {
    if (eaten >= 0) {
      eaten += dt;
      const lift = eaten < 3.6 ? Math.min(1, eaten * 4) : Math.max(0, 1 - (eaten - 3.6) * 3);
      lid.position.y = 0.12 + lift * 0.22;
      // eaten away, then back for v2
      const gone = Math.min(1, Math.max(0, (eaten - 0.25) * 2));
      const back = eaten > 3 ? Math.min(1, (eaten - 3) * 3) : 0;
      slice.scale.setScalar(Math.max(0.001, 1 - gone + back));
      if (eaten > 3 && eaten - dt <= 3) {
        say.say("Back for v2!", TEAL);
        sound.tone(880, 0.12, "triangle", 0.05, 1320);
      }
      if (eaten > 4) {
        eaten = -1;
        lid.position.y = 0.12;
        slice.scale.setScalar(1);
      }
    }
    say.update(dt);
  });
  s.add(g);
}

const SAME_SONG = ["New song!", "...it's the same song", "Still the same song", "There is one song"];

/** The jukebox in the corner. Change the song all you like. */
export function jukebox(s: THREE.Group, { pick, onFrame, sound }: EnvCtx) {
  const g = new THREE.Group();
  // in the far corner by the counter, angled at the table
  g.position.set(ROOM.x - 0.45, 0, -2.75);
  g.rotation.y = -Math.PI / 2 + 0.45;
  const size = 1.15;
  const wood = toon("#8a3a1d");
  const gold = new THREE.MeshStandardMaterial({ color: "#ffb02e", metalness: 0.5, roughness: 0.3 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.05, 0.5), wood);
  body.position.y = 0.525;
  body.castShadow = true;
  const arch = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.5, 20, 1, false, -Math.PI / 2, Math.PI), wood);
  arch.rotation.x = Math.PI / 2;
  arch.position.y = 1.05;
  const trim = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.025, 6, 20, Math.PI), gold);
  trim.position.set(0, 1.05, 0.26);
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 0.375),
    new THREE.MeshBasicMaterial({
      map: canvasTex(256, 192, (x) => {
        x.fillStyle = "#ffe7a6";
        x.fillRect(0, 0, 256, 192);
        x.fillStyle = "#8a3a1d";
        x.font = `bold 22px ${FONT}`;
        x.textAlign = "center";
        x.fillText("NOW PLAYING", 128, 30);
        x.font = `bold 20px ${FONT}`;
        x.fillText("“Deploy Me Tender”", 128, 182);
      }),
    }),
  );
  glass.position.set(0, 1.03, 0.255);
  const record = new THREE.Mesh(
    new THREE.CircleGeometry(0.115, 24),
    new THREE.MeshBasicMaterial({
      map: canvasTex(128, 128, (x) => {
        x.fillStyle = "#151515";
        x.beginPath();
        x.arc(64, 64, 63, 0, Math.PI * 2);
        x.fill();
        x.strokeStyle = "#3a3a3a";
        x.lineWidth = 2;
        for (const r of [24, 36, 48, 56]) {
          x.beginPath();
          x.arc(64, 64, r, 0, Math.PI * 2);
          x.stroke();
        }
        x.fillStyle = RED;
        x.beginPath();
        x.arc(64, 64, 16, 0, Math.PI * 2);
        x.fill();
        x.fillStyle = "#fff";
        x.fillRect(61, 50, 6, 10);
      }),
    }),
  );
  record.position.set(0, 1.035, 0.258);
  // the light-up bars, which cycle colours
  const bars = [0, 1, 2].map((i) => {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.05, 0.02),
      new THREE.MeshBasicMaterial({ color: "#ff3fa4" }),
    );
    bar.position.set(0, 0.72 - i * 0.1, 0.255);
    g.add(bar);
    return bar.material;
  });
  const grille = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.32), toon("#3a1a0c"));
  grille.position.set(0, 0.3, 0.255);
  for (const side of [-1, 1]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.0, 0.06), gold);
    pillar.position.set(side * 0.37, 0.55, 0.24);
    g.add(pillar);
  }
  g.add(body, arch, trim, glass, record, grille);
  const light = new THREE.PointLight("#ff6fb8", 1.2, 3, 1.8);
  light.position.set(0, 0.8, 0.6);
  g.add(light);
  const say = bubble(g, 1.4, 1.8);
  const bounce = wobble(12, 3);
  let party = 0;
  let changes = 0;
  const palette = ["#ff3fa4", "#3fd8ff", "#ffb02e", "#7dff8a"];
  pick(g, () => {
    party = 2.5;
    bounce.kick(0.05);
    say.say(SAME_SONG[changes % SAME_SONG.length] ?? "", "#8a3a1d");
    changes++;
    // the needle skips, then the same doo-wop riff again
    sound.noise(0.25, 2400, 0.12);
    sound.tone(900, 0.22, "sawtooth", 0.03, 180);
    [262, 330, 392, 440, 392, 330].forEach((f, i) => sound.tone(f, 0.22, "triangle", 0.05, undefined, 0.35 + i * 0.18));
  });
  onFrame((dt, t) => {
    party = Math.max(0, party - dt);
    record.rotation.z -= dt * (party > 0 ? 9 : 3.5);
    const speed = party > 0 ? 8 : 1;
    bars.forEach((m, i) => m.color.set(palette[Math.floor(t * speed + i) % palette.length] ?? "#fff"));
    light.intensity = party > 0 ? 1.6 + Math.sin(t * 20) * 0.6 : 1.2;
    const b = bounce.step(dt);
    g.scale.set(size * (1 - b), size * (1 + b), size * (1 - b));
    say.update(dt);
  });
  s.add(g);
}
