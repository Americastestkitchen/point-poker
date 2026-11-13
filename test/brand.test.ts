// The logo files are written from shared/brand.ts by `npm run brand`; they must match its shapes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SVG_FILES } from "../scripts/brand.ts";

const ROOT = join(import.meta.dirname, "..");

test("the committed logo SVGs match shared/brand.ts", () => {
  for (const [file, svg] of Object.entries(SVG_FILES)) {
    assert.equal(
      readFileSync(join(ROOT, file), "utf8"),
      svg,
      `${file} is out of date: run \`npm run brand\` and commit it`,
    );
  }
});
