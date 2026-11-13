// The Point Poker logo, as neon tubes: the framed "POINT POKER" sign and the poker chip mark.
// One source for every copy of it: scripts/brand.ts writes the SVG and PNG files from
// these shapes, and the room's neon sign draws the same tubes on a canvas.

/** A tube colour: the glowing glass and its bright core. */
export interface Neon {
  tube: string;
  core: string;
}

export const NEON = {
  pink: { tube: "#ff3fa4", core: "#ffe3f3" },
  cyan: { tube: "#3fd8ff", core: "#e2fbff" },
} as const satisfies Record<string, Neon>;

/** What an unlit tube looks like, for the letter that flickers. */
export const GLASS = "#3b1a33";
/** The dark wall behind the sign, and the tile behind the app icon. */
export const WALL = "#170a18";

export interface Tube {
  /** SVG path data, in the tube's own units. */
  d: string;
  /** Placed at (x, y), then scaled. */
  x: number;
  y: number;
  scale: number;
  tone: keyof typeof NEON;
  /** Stroke width in the tube's own units. */
  weight: number;
  /** The letter that drops out now and then. */
  flickers?: boolean;
}

export interface Drawing {
  /** The view box, with room around the tubes for their glow. */
  box: { x: number; y: number; width: number; height: number };
  tubes: readonly Tube[];
}

// Letters drawn as single strokes, 100 units tall: [path, width].
const LETTERS = {
  P: ["M0 100V0H28a25 25 0 0 1 0 50H0", 53],
  O: ["M28 0a28 28 0 0 1 28 28v44a28 28 0 0 1-56 0V28A28 28 0 0 1 28 0Z", 56],
  I: ["M0 0H20M10 0V100M0 100H20", 20],
  N: ["M0 100V0L50 100V0", 50],
  T: ["M0 0H56M28 0V100", 56],
  K: ["M0 0V100M48 0L4 58M22 40L52 100", 52],
  E: ["M50 0H0V100H50M0 50H38", 50],
  R: ["M0 100V0H28a25 25 0 0 1 0 50H0M24 50L52 100", 52],
} as const satisfies Record<string, readonly [string, number]>;
type Letter = keyof typeof LETTERS;

const round = (n: number) => Math.round(n * 100) / 100;
const polar = (r: number, degrees: number) => {
  const a = ((degrees - 90) * Math.PI) / 180;
  return `${round(50 + r * Math.cos(a))} ${round(50 + r * Math.sin(a))}`;
};
/** A ring broken into `n` arcs, like the spots on a chip's edge. */
function brokenRing(r: number, n: number, gap: number): string {
  let d = "";
  for (let i = 0; i < n; i++) {
    const from = (i * 360) / n + gap / 2;
    const to = ((i + 1) * 360) / n - gap / 2;
    d += `M${polar(r, from)}A${r} ${r} 0 0 1 ${polar(r, to)}`;
  }
  return d;
}
const circle = (r: number) => `M${50 - r} 50a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;

/** The chip, in a 100×100 box centred on (50, 50): cyan edge and inlay, pink P. */
const CHIP = [
  { d: brokenRing(44, 8, 14) + circle(30), tone: "cyan" },
  { d: "M42 68V32H53a10 10 0 0 1 0 20H42", tone: "pink" },
] as const;

function chip(x: number, y: number, size: number, weight: number): Tube[] {
  const scale = size / 100;
  return CHIP.map((part) => ({ ...part, x, y, scale, weight: weight / scale }));
}

/** Lays out a word left to right; returns its tubes and its width in letter units. */
function word(
  letters: readonly Letter[],
  o: { x: number; y: number; scale: number; tone: Tube["tone"]; weight: number; spacing: number; flicker?: number },
): { tubes: Tube[]; width: number } {
  const tubes: Tube[] = [];
  let at = 0;
  letters.forEach((letter, i) => {
    const [d, width] = LETTERS[letter];
    tubes.push({
      d,
      x: o.x + at * o.scale,
      y: o.y,
      scale: o.scale,
      tone: o.tone,
      weight: o.weight,
      ...(i === o.flicker && { flickers: true }),
    });
    at += width + (i < letters.length - 1 ? o.spacing : 0);
  });
  return { tubes, width: at * o.scale };
}

/** The sign: a cyan frame, a small cyan POINT with the chip after it, and a big pink POKER whose R flickers. */
export const LOGO: Drawing = (() => {
  const left = 110;
  const point = word(["P", "O", "I", "N", "T"], { x: left, y: 90, scale: 0.5, tone: "cyan", weight: 14, spacing: 30 });
  const poker = word(["P", "O", "K", "E", "R"], {
    x: left,
    y: 190,
    scale: 1,
    tone: "pink",
    weight: 10,
    spacing: 22,
    flicker: 4,
  });
  const width = poker.width + 2 * left;
  const height = 380;
  const [x0, y0, x1, y1, r] = [40, 40, width - 40, height - 40, 30];
  const frame: Tube = {
    d: `M${x0 + r} ${y0}H${x1 - r}a${r} ${r} 0 0 1 ${r} ${r}V${y1 - r}a${r} ${r} 0 0 1 ${-r} ${r}H${x0 + r}a${r} ${r} 0 0 1 ${-r} ${-r}V${y0 + r}a${r} ${r} 0 0 1 ${r} ${-r}Z`,
    x: 0,
    y: 0,
    scale: 1,
    tone: "cyan",
    weight: 8,
  };
  const size = 80;
  const tubes = [frame, ...point.tubes, ...chip(left + point.width + 30, 115 - size / 2, size, 8), ...poker.tubes];
  return { box: { x: 0, y: 0, width, height }, tubes };
})();

/** The chip on its own: the app icon and anywhere the full sign doesn't fit. */
export const MARK: Drawing = { box: { x: -12, y: -12, width: 124, height: 124 }, tubes: chip(0, 0, 100, 10) };

/** How each tube is stroked: a soft glow, the glass, then its bright core. Widths are multiples of the tube's weight. */
export const LAYERS = [
  { part: "glow", width: 2.8, opacity: 0.5 },
  { part: "tube", width: 1, opacity: 1 },
  { part: "core", width: 0.35, opacity: 1 },
] as const;
/** The glow's blur (a Gaussian's standard deviation), in each tube's own units, so it scales with the tube. */
export const GLOW_BLUR = 7;

/** The drawing as a standalone SVG. `tile` puts it on a dark rounded square, as an icon. */
export function toSvg(drawing: Drawing, o: { tile?: "rounded" | "square"; wall?: boolean } = {}): string {
  const { x, y, width, height } = drawing.box;
  const group = (t: Tube, inner: string) =>
    `<g transform="translate(${round(t.x)} ${round(t.y)}) scale(${round(t.scale * 1000) / 1000})">${inner}</g>`;
  const path = (t: Tube, stroke: string, width: number, extra = "") =>
    `<path d="${t.d}" stroke="${stroke}" stroke-width="${round(width)}"${extra}/>`;
  const lit = (t: Tube) =>
    LAYERS.map((l) => {
      const color = l.part === "core" ? NEON[t.tone].core : NEON[t.tone].tube;
      const extra = l.part === "glow" ? ` opacity="${l.opacity}" filter="url(#glow)"` : "";
      return path(t, color, t.weight * l.width, extra);
    }).join("");
  const body = drawing.tubes.map((t) => group(t, lit(t))).join("");
  const radius = o.tile === "rounded" ? ` rx="${round(width * 0.22)}"` : "";
  const back = o.tile
    ? `<rect x="${x}" y="${y}" width="${width}" height="${height}"${radius} fill="${WALL}"/>`
    : o.wall
      ? `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="url(#wall)"/>`
      : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${width} ${height}" fill="none" stroke-linecap="round" stroke-linejoin="round">
<defs><filter id="glow" filterUnits="userSpaceOnUse" x="${x - width}" y="${y - height}" width="${width * 3}" height="${height * 3}"><feGaussianBlur stdDeviation="${GLOW_BLUR}"/></filter>${
    o.wall
      ? `<radialGradient id="wall" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="#3a1430"/><stop offset=".55" stop-color="${WALL}"/><stop offset="1" stop-color="#0d070e"/></radialGradient>`
      : ""
  }</defs>
${back}${body}
</svg>
`;
}
