// Standup Station's easter eggs: the Sprint 42 that never stops here, the signal
// that calls it, the PA and its LED strip, the sprint lines map whose Done line
// is still being built, the busker's case, and the gap to mind.
import * as THREE from "three";
import { toon } from "../../scene/art/materials.ts";
import { FONT, canvasTex } from "../../scene/art/textures.ts";
import { oneShot } from "../kit/animate.ts";
import { box, cylinder, plane, put } from "../kit/build.ts";
import { liveCanvas } from "../kit/canvas.ts";
import { between } from "../kit/random.ts";
import type { EnvCtx } from "../types.ts";
import { ROOM, plaque } from "./room.ts";

const MONO = `"DejaVu Sans Mono", "Menlo", "Consolas", ui-monospace, monospace`;

// ---------------------------------------------------------------- the LED strip

/** What the strip scrolls when nobody's clicked anything. */
const IDLE = [
  "NEXT TRAIN: SPRINT 42 ··· DOES NOT STOP AT THIS STATION",
  "PLEASE STAND CLEAR OF THE CLOSING SPRINT",
  "THE 9:30 STANDUP IS RUNNING A FEW MINUTES OVER",
  "PLEASE KEEP YOUR ESTIMATES WITH YOU AT ALL TIMES",
];

export type Ticker = ReturnType<typeof ledTicker>;

/** A scrolling orange LED strip, hung from the ceiling and readable from both sides. */
export function ledTicker() {
  const W = 512;
  const H = 32;
  const { texture, g, redraw } = liveCanvas(W, H);
  const object = new THREE.Group();
  const width = 1.6;
  const height = (width * H) / W;
  object.add(box(width + 0.08, height + 0.08, 0.08, toon("#1a1a1a")));
  const face = new THREE.MeshBasicMaterial({ map: texture });
  for (const side of [1, -1]) object.add(put(plane(width, height, face), 0, 0, side * 0.041, side > 0 ? 0 : Math.PI));
  for (const x of [-0.6, 0.6]) object.add(put(cylinder(0.008, 0.008, 0.9, toon("#333")), x, height / 2 + 0.45, 0));
  let idle = 0;
  let text = IDLE[0] ?? "";
  let offset = 0;
  let step = 0;
  const draw = () => {
    g.fillStyle = "#140a04";
    g.fillRect(0, 0, W, H);
    g.font = `bold 26px ${MONO}`;
    g.textBaseline = "middle";
    g.fillStyle = "#ff9a1f";
    g.fillText(text, W - offset, H / 2 + 1);
    // the gaps between the LEDs
    g.fillStyle = "#000";
    for (let x = 3; x < W; x += 4) g.fillRect(x, 0, 1, H);
    for (let y = 3; y < H; y += 4) g.fillRect(0, y, W, 1);
    redraw();
  };
  draw();
  return {
    object,
    /** Scrolls `message` once, then goes back to the usual. */
    say(message: string) {
      text = message;
      offset = 0;
    },
    update(dt: number) {
      step -= dt;
      if (step > 0) return;
      step = 1 / 15;
      offset += 4;
      if (offset > W + g.measureText(text).width) {
        idle = (idle + 1) % IDLE.length;
        text = IDLE[idle] ?? "";
        offset = 0;
      }
      draw();
    },
  };
}

// ---------------------------------------------------------------- the PA

/** A PA announcement: a chime, then a mumble with an echo off the tiles. `syllables` mumbles, `vol` loud. */
function announce({ sound }: EnvCtx, syllables: number, vol: number) {
  for (const [i, f] of [659, 523, 392].entries()) sound.tone(f, 0.5, "sine", vol * 1.2, undefined, i * 0.32);
  let at = 1.1;
  for (let i = 0; i < syllables; i++) {
    const f = between(170, 280);
    const dur = 0.08 + Math.random() * 0.1;
    const slide = f * (0.8 + Math.random() * 0.4);
    for (const [echo, k] of [
      [0, 1],
      [0.21, 0.35],
      [0.42, 0.12],
    ] as const)
      sound.tone(f, dur, "sawtooth", vol * k, slide, at + echo);
    at += dur + 0.03 + (Math.random() < 0.2 ? 0.15 : 0);
  }
}

/** The PA horn hung beside the strip. Click it and it tells you how the 9:30 is going. */
export function paSpeaker(ctx: EnvCtx, ticker: Ticker) {
  const object = new THREE.Group();
  const grey = toon("#c9ccc4");
  const horn = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.16, 0.3, 14, 1, true),
    toon("#c9ccc4", { side: THREE.DoubleSide }),
  );
  horn.rotation.z = Math.PI / 2 - 0.35;
  const driver = put(cylinder(0.06, 0.06, 0.1, grey, 12), 0.17, 0.06, 0);
  driver.rotation.z = Math.PI / 2 - 0.35;
  object.add(horn, driver, put(box(0.03, 0.4, 0.03, toon("#333")), 0.2, 0.25, 0));
  const wobble = oneShot(3.5);
  let next = between(60, 120);
  ctx.onFrame((dt) => {
    next -= dt;
    if (next <= 0) {
      next = between(120, 240);
      announce(ctx, 9, 0.012); // somewhere down the platform, nobody's listening
    }
    const left = wobble.step(dt);
    if (left === null) return;
    horn.scale.setScalar(1 + Math.sin(left * 60) * 0.08 * Math.min(1, left * 4));
  });
  ctx.pick(object, () => {
    announce(ctx, 13, 0.03);
    wobble.kick();
    ticker.say("THE 9:30 STANDUP IS RUNNING FIFTEEN MINUTES OVER. WE APOLOGISE FOR ANY ESTIMATES.");
  });
  return object;
}

// ---------------------------------------------------------------- the train

/** Each carriage's length, and the gap between them. */
const CAR = 4.2;
const COUPLING = 0.25;
const CARS = 3;
const TRAIN_LENGTH = CARS * CAR + (CARS - 1) * COUPLING;
/** Where the wheels are, back from the front of the train, for the clatter. */
const BOGIES = Array.from({ length: CARS }, (_, i) => [
  i * (CAR + COUPLING) + 0.7,
  i * (CAR + COUPLING) + CAR - 0.7,
]).flat();

function carriageSide(): THREE.CanvasTexture {
  return canvasTex(1024, 512, (g) => {
    g.fillStyle = "#c3cad0";
    g.fillRect(0, 0, 1024, 512);
    g.fillStyle = "#e8434f";
    g.fillRect(0, 340, 1024, 36);
    const faces = ["#f2c9a0", "#c68a5a", "#8a5a3a", "#f5d6b8", "#e0a878"];
    // doors and windows, with the rest of the team already on board
    for (let i = 0; i < 4; i++) {
      const x = 40 + i * 250;
      g.fillStyle = "#9aa3aa";
      g.fillRect(x, 70, 90, 420);
      g.fillStyle = "#2a3b4a";
      g.fillRect(x + 12, 90, 30, 170);
      g.fillRect(x + 48, 90, 30, 170);
      if (i === 3) continue;
      g.fillRect(x + 110, 90, 120, 170);
      const face = faces[i % faces.length] ?? "#f2c9a0";
      g.fillStyle = face;
      g.beginPath();
      g.arc(x + 150 + i * 12, 200, 30, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#111";
      g.fillRect(x + 140 + i * 12, 192, 6, 8);
      g.fillRect(x + 158 + i * 12, 192, 6, 8);
    }
    g.fillStyle = "#2a3b4a";
    g.fillRect(800, 30, 190, 40);
    g.fillStyle = "#ffb02e";
    g.font = `bold 30px ${MONO}`;
    g.textAlign = "center";
    g.fillText("SPRINT 42", 895, 60);
  });
}

function trainFront(): THREE.CanvasTexture {
  return canvasTex(256, 512, (g) => {
    g.fillStyle = "#c3cad0";
    g.fillRect(0, 0, 256, 512);
    g.fillStyle = "#e8434f";
    g.fillRect(0, 340, 256, 36);
    g.fillStyle = "#2a3b4a";
    g.fillRect(30, 30, 196, 50);
    g.fillStyle = "#ffb02e";
    g.font = `bold 34px ${MONO}`;
    g.textAlign = "center";
    g.fillText("SPRINT 42", 128, 68);
    g.fillStyle = "#2a3b4a";
    g.fillRect(30, 100, 196, 150);
    g.fillStyle = "#fff6c8";
    for (const x of [60, 196]) {
      g.beginPath();
      g.arc(x, 420, 22, 0, Math.PI * 2);
      g.fill();
    }
  });
}

/**
 * The Sprint 42: it pulls in now and then, crawls along like it might stop, honks,
 * and leaves without stopping. The signal at the end of the platform calls it; clicking
 * it while it's in makes it honk and hurry off.
 */
export function sprintTrain(ctx: EnvCtx, ticker: Ticker) {
  const { sound, onFrame, pick } = ctx;
  const { track, trench, edge, side } = ROOM;
  const group = new THREE.Group();
  const train = put(new THREE.Group(), track, trench, -40);
  train.visible = false;
  const silver = toon("#c3cad0");
  const roof = toon("#8f979e");
  const sideMat = toon("#ffffff", { map: carriageSide() });
  for (let i = 0; i < CARS; i++) {
    const car = put(new THREE.Group(), 0, 0, -i * (CAR + COUPLING) - CAR / 2);
    const body = put(box(1.2, 2.2, CAR, silver), 0, 1.25, 0);
    const top = put(box(1.0, 0.12, CAR - 0.2, roof), 0, 2.4, 0);
    const decal = put(plane(CAR - 0.08, 2.0, sideMat), -0.605, 1.25, 0, -Math.PI / 2);
    car.add(body, top, decal);
    train.add(car);
  }
  train.add(put(plane(1.1, 2.0, toon("#ffffff", { map: trainFront() })), 0, 1.25, 0.005));
  const headlight = put(new THREE.PointLight("#fff6c8", 0, 4, 1.6), 0, 0.6, 0.6);
  train.add(headlight);
  group.add(train);

  // the signal at the end of the platform, by the tunnel the train comes out of
  const signal = put(new THREE.Group(), edge - 0.25, 0, -side + 0.45);
  const post = put(cylinder(0.03, 0.04, 1.6, toon("#2b2622"), 8), 0, 0.8, 0);
  const head = put(box(0.16, 0.36, 0.12, toon("#1a1a1a")), 0, 1.75, 0);
  const red = new THREE.MeshBasicMaterial({ color: "#ff3b3b" });
  const green = new THREE.MeshBasicMaterial({ color: "#163a1c" });
  const lamps = new THREE.Group();
  lamps.add(
    put(new THREE.Mesh(new THREE.CircleGeometry(0.045, 12), red), 0, 1.83, 0.062),
    put(new THREE.Mesh(new THREE.CircleGeometry(0.045, 12), green), 0, 1.67, 0.062),
  );
  // turned to face down the platform, towards the table
  lamps.rotation.y = -Math.PI / 2;
  head.rotation.y = -Math.PI / 2;
  signal.add(post, head, lamps);
  group.add(signal);

  type State = "idle" | "in" | "crawl" | "out";
  let state: State = "idle";
  let wait = between(25, 60);
  let head0 = -40; // where the front of the train is, along z
  let v = 0;
  let crawl = 0;
  const honk = (delay = 0) => {
    sound.tone(330, 0.45, "sawtooth", 0.03, undefined, delay);
    sound.tone(415, 0.45, "sawtooth", 0.025, undefined, delay);
  };
  const start = () => {
    state = "in";
    head0 = -30;
    v = 13;
    train.visible = true;
    for (let k = 0; k < 6; k++) sound.noise(0.7, 90 + k * 10, 0.012 * (k + 1), k * 0.4);
  };
  onFrame((dt) => {
    const before = head0;
    switch (state) {
      case "idle":
        wait -= dt;
        if (wait <= 0) start();
        break;
      case "in": {
        // brakes hard, as if it's going to stop
        const f = Math.min(1, Math.max(0, (1.5 - head0) / 22));
        v = 1.6 + (13 - 1.6) * f;
        if (head0 > -3 && f < 0.25 && crawl === 0) {
          sound.tone(2300, 1.4, "sine", 0.012, 2150);
          sound.tone(3100, 1.1, "sine", 0.006, 2900);
          crawl = 1;
        }
        if (head0 >= 1.5) {
          state = "crawl";
          crawl = 1.3;
        }
        break;
      }
      case "crawl":
        // ... and then doesn't
        v = 1.6;
        crawl -= dt;
        if (crawl <= 0) {
          honk();
          honk(0.55);
          state = "out";
        }
        break;
      case "out":
        v = Math.min(18, v + 6 * dt);
        if (head0 - TRAIN_LENGTH > 30) {
          state = "idle";
          wait = between(80, 160);
          crawl = 0;
          train.visible = false;
          head0 = -40;
        }
        break;
    }
    if (state !== "idle") head0 += v * dt;
    train.position.z = head0;
    train.position.y = train.visible ? trench : -60; // out of the way of clicks while it's gone
    headlight.intensity = train.visible ? 2.5 : 0;
    // clackety-clack, as each set of wheels crosses the rail joint by the table
    for (const b of BOGIES)
      if (before - b < 0 && head0 - b >= 0 && Math.abs(v) > 0.5) {
        sound.noise(0.05, 320, 0.05);
        sound.noise(0.05, 260, 0.04, 0.08);
      }
    const coming = state !== "idle" && head0 - TRAIN_LENGTH < side;
    red.color.set(coming ? "#3a1212" : "#ff3b3b");
    green.color.set(coming ? "#3bff6a" : "#163a1c");
  });
  pick(signal, () => {
    sound.tone(880, 0.12, "square", 0.03);
    sound.tone(1175, 0.18, "square", 0.03, undefined, 0.13);
    if (state === "idle") {
      wait = 1.5;
      ticker.say("SPRINT 42 IS APPROACHING. IT WILL NOT BE STOPPING. IT NEVER STOPS.");
    } else ticker.say("SPRINT 42 IS ALREADY HERE. AND THEN IT ISN'T.");
  });
  pick(train, () => {
    honk();
    if (state === "in" || state === "crawl") {
      state = "out";
      v = Math.max(v, 6);
    }
    ticker.say("SPRINT 42 WILL BE SKIPPING THIS STATION, AND ALSO THE NEXT ONE");
  });
  return group;
}

// ---------------------------------------------------------------- the line map

/** The sprint lines map: Backlog and In Progress run all the way; Done is still being built. */
export function lineMap(ctx: EnvCtx, ticker: Ticker) {
  const W = 512;
  const H = 400;
  const { texture, g, redraw } = liveCanvas(W, H);
  const draw = (progress: number) => {
    g.fillStyle = "#fbf8f0";
    g.fillRect(0, 0, W, H);
    g.strokeStyle = "#555";
    g.lineWidth = 8;
    g.strokeRect(4, 4, W - 8, H - 8);
    g.fillStyle = "#222";
    g.font = `900 40px ${FONT}`;
    g.textAlign = "center";
    g.fillText("SPRINT LINES", W / 2, 58);
    g.textAlign = "left";
    const lines = [
      { name: "Backlog", color: "#e8434f", y: 130, end: 1, stops: [0.1, 0.4, 0.7, 0.95] },
      { name: "In Progress", color: "#2b6fd6", y: 230, end: 1, stops: [0.2, 0.6, 0.9] },
      { name: "Done", color: "#2f8c4a", y: 330, end: 0.42 + progress * 0.4, stops: [0.1] },
    ];
    const x0 = 40;
    const span = W - 80;
    for (const l of lines) {
      g.strokeStyle = l.color;
      g.lineCap = "round";
      g.lineWidth = 16;
      g.setLineDash([]);
      g.beginPath();
      g.moveTo(x0, l.y);
      g.lineTo(x0 + span * l.end, l.y);
      g.stroke();
      if (l.end < 1) {
        g.lineWidth = 8;
        g.setLineDash([14, 14]);
        g.beginPath();
        g.moveTo(x0 + span * l.end + 20, l.y);
        g.lineTo(x0 + span, l.y);
        g.stroke();
        g.setLineDash([]);
        // a little road cone where the work's got to
        const cx = x0 + span * l.end + 8;
        g.fillStyle = "#ff8a1c";
        g.beginPath();
        g.moveTo(cx, l.y - 34);
        g.lineTo(cx - 13, l.y + 4);
        g.lineTo(cx + 13, l.y + 4);
        g.fill();
        g.fillStyle = "#fff";
        g.fillRect(cx - 7, l.y - 18, 14, 5);
        g.fillStyle = "#c8323c";
        g.font = `bold 22px ${FONT}`;
        g.fillText("(under construction)", x0 + span * 0.5, l.y + 46);
      }
      for (const s of l.stops) {
        g.fillStyle = "#fff";
        g.strokeStyle = "#222";
        g.lineWidth = 5;
        g.beginPath();
        g.arc(x0 + span * s, l.y, 12, 0, Math.PI * 2);
        g.fill();
        g.stroke();
      }
      g.fillStyle = "#222";
      g.font = `bold 26px ${FONT}`;
      g.fillText(l.name, x0, l.y - 22);
    }
    redraw();
  };
  draw(0);
  const object = new THREE.Group();
  const frame = box(1.36, 1.1, 0.04, toon("#444"));
  object.add(frame, put(plane(1.28, 1.0, toon("#ffffff", { map: texture })), 0, 0, 0.021));

  const works = oneShot(2.2);
  let tick = 0;
  ctx.onFrame((dt) => {
    const work = works.step(dt);
    if (work === null) return;
    tick -= dt;
    if (work > 0.15 && tick <= 0) {
      tick = 0.06;
      ctx.sound.noise(0.03, between(700, 1100), 0.03);
    }
    draw(work > 0.15 ? Math.min(1, (1 - work) / 0.85) : 0);
    if (work === 0) draw(0);
  });
  ctx.pick(object, () => {
    if (works.left > 0) return;
    works.kick();
    // ... and then the money runs out
    const sad = [392, 370, 349, 330] as const;
    sad.forEach((f, i) =>
      ctx.sound.tone(f, i === 3 ? 0.9 : 0.32, "sawtooth", 0.025, i === 3 ? 290 : undefined, 1.9 + i * 0.34),
    );
    ticker.say("THE DONE LINE IS CLOSED FOR SCOPE WORKS UNTIL FURTHER NOTICE");
  });
  return object;
}

// ---------------------------------------------------------------- the busker's case

/** A guitar case's outline, lying along x. */
function guitarShape(): THREE.Shape {
  return new THREE.Shape()
    .moveTo(-0.52, 0)
    .bezierCurveTo(-0.52, 0.24, -0.12, 0.26, -0.08, 0.14)
    .bezierCurveTo(-0.04, 0.2, 0.2, 0.2, 0.2, 0.08)
    .lineTo(0.55, 0.06)
    .lineTo(0.55, -0.06)
    .lineTo(0.2, -0.08)
    .bezierCurveTo(0.2, -0.2, -0.04, -0.2, -0.08, -0.14)
    .bezierCurveTo(-0.12, -0.26, -0.52, -0.24, -0.52, 0);
}

/** A busker's open guitar case, a few coins in it. The busker's on a break; click it and someone plays anyway. */
export function buskerCase(ctx: EnvCtx, ticker: Ticker) {
  const object = new THREE.Group();
  const shape = guitarShape();
  const leather = toon("#6b4128");
  const shell = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, { depth: 0.09, bevelEnabled: false, curveSegments: 8 }),
    leather,
  );
  shell.rotation.x = -Math.PI / 2;
  shell.castShadow = true;
  const velvetGeo = new THREE.ShapeGeometry(shape, 8);
  velvetGeo.scale(0.92, 0.82, 1);
  const velvet = put(new THREE.Mesh(velvetGeo, toon("#7a2a4a")), 0, 0.092, 0);
  velvet.rotation.x = -Math.PI / 2;
  object.add(shell, velvet);
  // the lid, propped open behind
  const hinge = put(new THREE.Group(), 0, 0.09, -0.2);
  const lidGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: false, curveSegments: 8 });
  const lid = put(new THREE.Mesh(lidGeo, leather), 0, 0, 0.2);
  lid.rotation.x = -Math.PI / 2;
  hinge.add(lid);
  hinge.rotation.x = -1.85;
  object.add(hinge);
  const gold = toon("#ffd34d");
  const coinGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.006, 12);
  const coins: THREE.Mesh[] = [];
  for (const [x, z] of [
    [-0.36, 0.05],
    [-0.28, -0.08],
    [-0.2, 0.1],
    [-0.12, 0.02],
    [0.05, -0.05],
  ] as const) {
    const coin = put(new THREE.Mesh(coinGeo, gold), x, 0.097, z);
    coins.push(coin);
    object.add(coin);
  }
  const card = plaque(0.34, 0.12, (g, w, h) => {
    g.fillStyle = "#fff6dc";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#333";
    g.font = `bold ${Math.round(h * 0.42)}px "Comic Sans MS", ${FONT}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("will point 4 coins", w / 2, h * 0.55);
  });
  card.position.set(0.25, 0.13, 0.06);
  card.rotation.x = -0.9;
  object.add(card);
  // a note that floats up when someone plays
  const noteMat = new THREE.MeshBasicMaterial({
    map: canvasTex(64, 64, (g) => {
      g.fillStyle = "#ffd34d";
      g.font = `bold 56px ${FONT}`;
      g.textAlign = "center";
      g.fillText("♪", 32, 52);
    }),
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const note = plane(0.16, 0.16, noteMat);
  note.visible = false;
  object.add(note);

  /** Somebody somewhere plays a little phrase, echoing off the tiles. */
  const busk = (vol: number) => {
    const tune = [392, 494, 587, 784, 587, 659];
    tune.forEach((f, i) => {
      ctx.sound.tone(f, 0.35, "triangle", vol, undefined, i * 0.2);
      ctx.sound.tone(f, 0.35, "triangle", vol * 0.3, undefined, i * 0.2 + 0.24);
    });
  };

  const plays = oneShot(1.6);
  let next = between(45, 105);
  const hop = coins[2];
  ctx.onFrame((dt) => {
    next -= dt;
    if (next <= 0) {
      next = between(90, 180);
      busk(0.01);
    }
    const play = plays.step(dt);
    if (play === null) return;
    const up = 1 - play;
    note.visible = play > 0;
    note.position.set(-0.2 + Math.sin(up * 9) * 0.05, 0.25 + up * 0.7, 0);
    note.rotation.y = up * 4;
    if (hop) {
      hop.position.y = 0.097 + Math.max(0, Math.sin(Math.min(1, up * 2) * Math.PI)) * 0.25;
      hop.rotation.x = up * 18;
    }
    hinge.rotation.x = -1.85 + Math.sin(up * 40) * 0.06 * play;
  });
  ctx.pick(object, () => {
    for (const [i, f] of [2600, 3150, 2900].entries()) ctx.sound.tone(f, 0.12, "triangle", 0.03, undefined, i * 0.07);
    busk(0.035);
    plays.kick();
    ticker.say("THE BUSKER WILL POINT ANY TICKET FOR 4 COINS. NO REFUNDS IF IT'S AN 8.");
  });
  return object;
}

// ---------------------------------------------------------------- the gap

/** Click the yellow line and it reminds you, loudly, about the gap between the estimate and the actual. */
export function mindTheGap(ctx: EnvCtx, line: THREE.Mesh, ticker: Ticker) {
  const mats = [line.material].flat();
  const flashes = oneShot(1.6);
  ctx.onFrame((dt) => {
    const flash = flashes.step(dt);
    if (flash === null) return;
    const on = Math.sin(flash * 30) > 0 ? 0.6 * flash : 0;
    for (const m of mats) if (m instanceof THREE.MeshToonMaterial) m.emissiveIntensity = on;
  });
  ctx.pick(line, () => {
    flashes.kick();
    for (const [i, f] of [784, 659, 523].entries()) ctx.sound.tone(f, 0.4, "sine", 0.035, undefined, i * 0.28);
    ticker.say("MIND THE GAP. ESTIMATE: 3 POINTS. ACTUAL: 13 POINTS. MIND IT.");
  });
}
