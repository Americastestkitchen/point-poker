// The departure board behind the dealer: a split-flap board whose letters clatter
// round to the new ticket when it changes. Its clock says the 9:30 is running over,
// and it gets later the longer you stand there.
import * as THREE from "three";
import { toon } from "../../scene/art/materials.ts";
import { box, cylinder, plane, put } from "../kit/build.ts";
import { between, jitter } from "../kit/random.ts";
import { statusCanvas, type PaintStatus, type StatusLines } from "../kit/status.ts";
import type { EnvCtx, StatusScreen } from "../types.ts";
import { ROOM } from "./room.ts";

const W = 1024;
const H = 512;
const MONO = `"DejaVu Sans Mono", "Menlo", "Consolas", ui-monospace, monospace`;
/** What a flap shows while it's on its way round. */
const FLAPS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-/";
/** Board seconds for each minute on its clock. */
const MINUTE = 30;

/** One row of flaps: how many there are, how tall, and in which colour. */
interface Row {
  y: number;
  cells: number;
  height: number;
  color: string;
}
const ROWS: Row[] = [
  { y: 84, cells: 12, height: 104, color: "#ffb02e" },
  { y: 212, cells: 22, height: 72, color: "#ffb02e" },
  { y: 292, cells: 22, height: 72, color: "#ffb02e" },
  { y: 396, cells: 20, height: 84, color: "#7ee08a" },
];

/** Breaks `text` into rows of at most `width` characters, on spaces where it can. */
function wrap(text: string, width: number, rows: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= width) line = next;
    else {
      if (line) out.push(line);
      line = word.slice(0, width);
    }
  }
  if (line) out.push(line);
  if (out.length > rows) {
    const last = out[rows - 1] ?? "";
    out.length = rows;
    out[rows - 1] = `${last.slice(0, width - 1)}…`;
  }
  return out;
}

/** The text on each row of flaps. */
function rowsOf(lines: StatusLines): string[] {
  const sub = wrap(lines.subtitle.toUpperCase(), 22, 2);
  return [lines.title.toUpperCase(), sub[0] ?? "", sub[1] ?? "", lines.status.toUpperCase()];
}

export function departureBoard({ sound, onFrame }: EnvCtx): StatusScreen {
  /** Seconds since the board went up. */
  let clock = 0;
  /** The flip in progress: what the flaps showed before, and when it started. */
  let flip: { from: string[]; at: number } | null = null;
  let shown: string[] = [];

  /** What flap `i` of row `r` shows right now, and whether it's still turning. */
  const flapAt = (r: number, i: number, target: string): [string, boolean] => {
    if (!flip) return [target, false];
    const before = flip.from[r]?.charAt(i) ?? "";
    if (before === target) return [target, false];
    const start = flip.at + r * 0.12 + i * 0.03;
    const settle = start + 0.25 + jitter(r, i) * 0.45; // each flap takes its own time to settle
    if (clock < start) return [before, true];
    if (clock >= settle) return [target, false];
    return [FLAPS.charAt(Math.floor((clock - start) / 0.05 + jitter(i, r) * 30) % FLAPS.length), true];
  };

  let turning = 0;
  const paint: PaintStatus = (g, lines) => {
    const rows = rowsOf(lines);
    shown = rows;
    turning = 0;
    g.fillStyle = "#121212";
    g.fillRect(0, 0, W, H);
    // the header: what this is, and how late it's got
    g.textBaseline = "middle";
    g.font = `bold 34px ${MONO}`;
    g.fillStyle = "#8c8c8c";
    g.textAlign = "left";
    g.fillText("DEPARTURES  ·  PLATFORM 1", 28, 38);
    const minutes = 30 + Math.floor(clock / MINUTE);
    const hh = 9 + Math.floor(minutes / 60);
    const mm = minutes % 60;
    g.textAlign = "right";
    g.fillStyle = "#ff6b6b";
    g.fillText(`${hh}:${String(mm).padStart(2, "0")}`, W - 28, 38);
    ROWS.forEach((row, r) => {
      const text = rows[r] ?? "";
      const gap = 6;
      const cw = (W - 56 - gap * (row.cells - 1)) / row.cells;
      g.font = `bold ${Math.round(row.height * 0.72)}px ${MONO}`;
      g.textAlign = "center";
      for (let i = 0; i < row.cells; i++) {
        const x = 28 + i * (cw + gap);
        const [ch, moving] = flapAt(r, i, text.charAt(i));
        if (moving) turning++;
        g.fillStyle = moving ? "#2a2a2a" : "#202020";
        g.fillRect(x, row.y, cw, row.height);
        g.fillStyle = moving ? "#ffe39a" : row.color;
        g.fillText(ch, x + cw / 2, row.y + row.height * 0.54, cw);
        // the hinge across the middle of each flap
        g.fillStyle = "#000";
        g.fillRect(x, row.y + row.height / 2 - 1.5, cw, 3);
      }
    });
  };

  const status = statusCanvas(W, H, paint);
  const object = new THREE.Group();
  const width = 1.7;
  const height = (width * H) / W;
  const frame = box(width + 0.1, height + 0.1, 0.12, toon("#1a1a1a"));
  const face = put(plane(width, height, new THREE.MeshBasicMaterial({ map: status.texture })), 0, 0, 0.061);
  object.add(frame, face);
  // hung from the ceiling on two rods
  const rodLength = ROOM.ceiling - 1.95 - height / 2 - 0.05;
  for (const x of [-0.6, 0.6])
    object.add(put(cylinder(0.012, 0.012, rodLength, toon("#333")), x, height / 2 + 0.05 + rodLength / 2, 0));
  object.add(put(new THREE.PointLight("#ffb02e", 0.8, 2.5, 2), 0, 0, 0.5));

  let minute = 0;
  let clack = 0;
  onFrame((dt) => {
    clock += dt;
    const nowMinute = Math.floor(clock / MINUTE);
    if (flip) {
      status.draw();
      clack -= dt;
      if (turning > 0 && clack <= 0) {
        clack = between(0.03, 0.06);
        sound.noise(0.015, between(2200, 4000), Math.min(0.035, 0.006 * turning));
      }
      if (turning === 0) flip = null;
    } else if (nowMinute !== minute) status.draw();
    minute = nowMinute;
  });

  const screen = status.screen(object);
  return {
    object,
    show(title, subtitle, statusLine) {
      flip = { from: shown, at: clock };
      screen.show(title, subtitle, statusLine);
    },
  };
}
