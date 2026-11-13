#!/usr/bin/env node
// Writes the logo files from shared/brand.ts: the SVG sources, the favicon, the
// apple-touch-icon and the social preview image. Run it after changing the logo:
//
//   npm run brand
//
// The PNGs need `rsvg-convert` (librsvg: `brew install librsvg`, `apt install librsvg2-bin`).
// The files are committed, so the build and the deploy don't need it.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { LOGO, MARK, toSvg, type Drawing } from "../shared/brand.ts";

const ROOT = join(import.meta.dirname, "..");
const PUBLIC = join(ROOT, "client/public");

/** The SVG files, by path from the repo root. test/brand.test.ts checks they match the shapes. */
export const SVG_FILES = {
  "assets/logo.svg": toSvg(LOGO),
  "assets/mark.svg": toSvg(MARK),
  "client/public/favicon.svg": toSvg(MARK, { tile: "rounded" }),
};

/** The sign centred on the wall, in the 1200×630 shape link previews use. */
function socialCard(): Drawing {
  const { width, height } = LOGO.box;
  const h = height + 80;
  const w = (h * 1200) / 630;
  return { ...LOGO, box: { x: -(w - width) / 2, y: -(h - height) / 2, width: w, height: h } };
}

function png(svg: string, file: string, width: number, height = width) {
  const out = execFileSync("rsvg-convert", ["-w", String(width), "-h", String(height)], { input: svg });
  writeFileSync(join(PUBLIC, file), out);
}

if (import.meta.main) {
  for (const [file, svg] of Object.entries(SVG_FILES)) {
    mkdirSync(dirname(join(ROOT, file)), { recursive: true });
    writeFileSync(join(ROOT, file), svg);
  }
  mkdirSync(PUBLIC, { recursive: true });
  png(SVG_FILES["client/public/favicon.svg"], "favicon-32.png", 32);
  // iOS rounds the corners itself, so the tile is square.
  png(toSvg(MARK, { tile: "square" }), "apple-touch-icon.png", 180);
  png(toSvg(socialCard(), { wall: true }), "og.png", 1200, 630);
  console.log("Wrote the logo, mark, favicons and og.png.");
}
