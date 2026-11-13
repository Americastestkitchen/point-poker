import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createToasts } from "./toasts.ts";
import { cssVars, tokensCss, varName } from "./tokens.ts";

const here = import.meta.dirname;
/** The kit, and the game screens built from it: both style themselves with tokens only. */
const STYLED = [here, join(here, "..", "screens")];

/** Every stylesheet in the kit and the screens. */
function kitCss(): { file: string; css: string }[] {
  const out: { file: string; css: string }[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".css")) out.push({ file: p, css: readFileSync(p, "utf8") });
    }
  };
  for (const dir of STYLED) walk(dir);
  return out;
}

test("tokens become CSS variables", () => {
  assert.equal(varName("color", "neonPink"), "--pp-color-neon-pink");
  assert.equal(cssVars()["--pp-space-3"], "12px");
  assert.match(tokensCss(), /^:root \{\n  --pp-color-backdrop: #07050a;/);
});

test("the kit's and screens' stylesheets only use tokens that exist", () => {
  const known = new Set(Object.keys(cssVars()));
  const sheets = kitCss();
  assert.ok(sheets.some((s) => s.file.includes("screens")), "the screens' stylesheets are checked too");
  for (const { file, css } of sheets) {
    for (const [, name] of css.matchAll(/var\((--pp-[\w-]+)/g)) {
      assert.ok(known.has(name!), `${file} uses ${name}, which isn't a token`);
    }
  }
});

test("the kit's and screens' stylesheets write no raw colours: they come from tokens", () => {
  for (const { file, css } of kitCss()) {
    const raw = css.replace(/\/\*[\s\S]*?\*\//g, "").match(/#[0-9a-f]{3,8}\b|rgba?\(/gi);
    assert.equal(raw, null, `${file} has raw colours: ${raw?.join(", ")}`);
  }
});

test("toasts stack up, drop the oldest past the limit, and leave on their own", () => {
  const timers: (() => void)[] = [];
  const toasts = createToasts({ after: (_ms, fn) => void timers.push(fn) });
  let changes = 0;
  toasts.subscribe(() => changes++);
  const a = toasts.show("SD-123 was updated");
  toasts.show("Couldn't reach Jira", { tone: "error" });
  assert.deepEqual(toasts.get().map((t) => t.tone), ["info", "error"]);
  for (let i = 0; i < 4; i++) toasts.show(`t${i}`);
  assert.equal(toasts.get().length, 4);
  assert.ok(!toasts.get().some((t) => t.id === a), "the oldest went first");
  timers.forEach((fire) => fire());
  assert.equal(toasts.get().length, 0);
  assert.equal(changes, 10, "6 shown, 4 gone: the 2 pushed out already left");
});
