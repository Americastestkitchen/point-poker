// Who may import whom. Every rule is data: the files it covers, what they may
// not import, and why. A broken rule fails with the file, the import and the
// reason, so the fix is to do what the reason says, not to add an exception.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, posix } from "node:path";

const ROOT = join(import.meta.dirname, "..");

// Paths are from the repo root. A path ending in "/" means the whole folder;
// "*" means any file in the repo. Anything else not a path is a package ("three").
interface Rule {
  name: string;
  files: string[];
  except?: string[];
  forbid: string[];
  /** Carved out of `forbid`. */
  allow?: string[];
  /** Type-only imports are fine: they vanish from the build. */
  types?: boolean;
  why: string;
}

const WORLD = ["client/src/scene/", "client/src/avatar/", "client/src/environments/"];
// UI paths: app-aware game screens (title screens and HUD) and the independent ui/ kit.
const UI = ["client/src/screens/", "client/src/ui/"];

const RULES: Rule[] = [
  {
    name: "shared stands alone",
    files: ["shared/"],
    forbid: ["*"],
    allow: ["shared/"],
    why: "server and browser both run shared/, so it imports only from shared/ and packages.",
  },
  {
    name: "server without client",
    files: ["server/"],
    forbid: ["client/"],
    why: "the server never loads browser code; move what both need into shared/.",
  },
  {
    name: "client takes only types from server",
    files: ["client/src/"],
    forbid: ["server/"],
    types: true,
    why: "a value import pulls server code into the bundle; use `import type`, or move the value into shared/.",
  },
  {
    name: "the table is plain logic",
    files: ["server/table/"],
    forbid: ["server/transport/", "server/store/", "server/auth/"],
    why: "server/table/ has no sockets, files or passcodes; server/main.ts wires the adapters around it.",
  },
  {
    name: "the table takes only types from tickets",
    files: ["server/table/"],
    forbid: ["server/tickets/"],
    types: true,
    why: "the table gets its TicketSource passed in; it only needs the type from server/tickets/source.ts.",
  },
  {
    name: "app is not visual",
    files: ["client/src/app/"],
    forbid: [...WORLD, "client/src/ui/", "client/src/screens/", "three"],
    why: "client/src/app/ is the store, events, actions and session; the 3D world and the UI read it, never the other way round.",
  },
  {
    name: "the 3D world doesn't import the UI",
    files: WORLD,
    forbid: UI,
    why: "the world and the UI talk through the store: emit a GameEvent on store.events and let the UI react.",
  },
  {
    name: "the UI doesn't import the 3D world",
    files: UI,
    forbid: WORLD,
    why: "the UI and the world talk through the store: read it, call actions, or listen on store.events; shared data goes in shared/.",
  },
  {
    name: "screens use the kit through its front door",
    files: ["client/src/screens/"],
    forbid: ["client/src/ui/"],
    allow: ["client/src/ui/index.ts"],
    why: "screens import the kit from ui/index.ts only; if a screen needs something the kit doesn't export, add a generic primitive to ui/ and export it there.",
  },
  {
    name: "screens are the game UI, not its wiring",
    files: ["client/src/screens/"],
    forbid: ["client/src/main.ts", "client/src/app/session.ts"],
    why: "screens get the store, actions and services injected through useGame(); commands go through actions, never the session or socket.",
  },
  {
    name: "screens take only types from audio",
    files: ["client/src/screens/"],
    forbid: ["client/src/audio/"],
    types: true,
    why: "main.ts builds the audio and mic and injects them; screens only need their types.",
  },
  {
    name: "the UI kit stands alone",
    files: ["client/src/ui/"],
    except: ["client/src/ui/gallery/"],
    forbid: ["client/src/"],
    allow: ["client/src/ui/"],
    why: "the kit is generic: screens pass it what it shows. Only the dev gallery (ui/gallery/) wires in app/ and audio/.",
  },
  {
    name: "the gallery wires only app and audio",
    files: ["client/src/ui/gallery/"],
    forbid: ["client/src/"],
    allow: ["client/src/ui/", "client/src/app/", "client/src/audio/"],
    why: "the gallery shows the kit with real storage and sound; it doesn't mount the game.",
  },
  {
    name: "layout is passed in",
    files: ["client/src/"],
    except: ["client/src/scene/index.ts"],
    forbid: ["client/src/scene/layout/layout.ts"],
    types: true,
    why: "only scene/index.ts imports the `layout` value; take it as an argument (like buildTable and createTicketPaper) and use `import type { Layout }`.",
  },
  {
    name: "no three.js where the header says so",
    files: ["client/src/avatar/animator.ts", "client/src/scene/layout/layout.ts"],
    forbid: ["three"],
    why: "these files are plain numbers so they run in node tests; keep three.js in the files that build meshes.",
  },
];

interface TextRule {
  name: string;
  files: string[];
  except?: string[];
  pattern: RegExp;
  /** Read comments too (the other rules see only code). */
  comments?: boolean;
  /** Tests and fixtures too (the other rules skip them). */
  tests?: boolean;
  why: string;
}

/** A lint disable that names one rule, for the next line only, and says why. */
const LINT_DISABLE = /\b(?:eslint|oxlint)-(?:disable|enable)\b(?!-next-line [\w-]+(?:\/[\w-]+)? -- \S)[\w-]*/g;

/** Source-text rules: things no import shows. */
const TEXT_RULES: TextRule[] = [
  {
    name: "the 3D world doesn't touch the page",
    files: WORLD,
    pattern: /\bdocument\s*\.\s*(?!createElement\b)\w+|\.querySelector(All)?\s*\(/g,
    why: "don't reach into the page by id or selector; emit a GameEvent on store.events and let the UI react. document.createElement for a canvas is fine.",
  },
  {
    name: "the 3D world waits in frame time",
    files: WORLD,
    pattern: /\bset(Timeout|Interval)\b/g,
    why: "wall-clock timers drift from the frame loop when the tab is hidden or a frame is slow; use stage.after(seconds, fn), or a per-frame dt timer.",
  },
  {
    name: "a lint disable names its rule and says why",
    files: ["shared/", "server/", "client/src/", "test/", "scripts/", "vite.config.ts"],
    except: ["test/boundaries.test.ts"], // its examples of what's refused, below
    pattern: LINT_DISABLE,
    comments: true,
    tests: true,
    why: "fix the finding; where the rule is wrong for that one line, write `// oxlint-disable-next-line plugin/rule -- reason` (no file-wide, multi-rule or unexplained disables).",
  },
];

/** Known breaks, each with the issue that removes it. The test fails when one is no longer needed. */
const EXCEPTIONS: { file: string; imports: string; why: string; issue: number }[] = [];

// ---------------------------------------------------------------- reading the code

/** Tests (runtime *.test.ts and type-only *.test-d.ts) and fixtures may reach anywhere they need to. */
const exempt = (file: string) => /\.test(-d)?\.tsx?$/.test(file) || posix.basename(file) === "fixtures.ts";

function sources(dirs = ["shared", "server", "client/src"], ext = /\.tsx?$/): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
      const p = posix.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (ext.test(e.name)) out.push(p);
    }
  };
  for (const dir of dirs) walk(dir);
  return out;
}

interface Import {
  spec: string;
  line: number;
  typeOnly: boolean;
}

const STATIC =
  /^[ \t]*(import|export)\s+(type\s+)?(\*(?:\s+as\s+\w+)?|\{([^}]*)\}|\w+(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+))?)\s+from\s+["']([^"']+)["']/gm;
const BARE = /^[ \t]*import\s+["']([^"']+)["']/gm;
const DYNAMIC = /\bimport\(\s*["']([^"']+)["']\s*\)/g;

/** Every import in a file: static, re-exports, side effects and import(). */
function importsOf(src: string): Import[] {
  const line = (at: number) => src.slice(0, at).split("\n").length;
  const out: Import[] = [];
  for (const m of src.matchAll(STATIC)) {
    const named = m[4]
      ?.split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const typeOnly = !!m[2] || (!!named?.length && m[3]!.startsWith("{") && named.every((s) => s.startsWith("type ")));
    out.push({ spec: m[5]!, line: line(m.index), typeOnly });
  }
  for (const m of src.matchAll(BARE)) out.push({ spec: m[1]!, line: line(m.index), typeOnly: false });
  for (const m of src.matchAll(DYNAMIC)) out.push({ spec: m[1]!, line: line(m.index), typeOnly: false });
  return out;
}

/** A relative import as a repo path; a package as its name ("three/addons/x" is "three"). */
function resolve(file: string, spec: string): string {
  const s = spec.split("?")[0]!;
  if (s.startsWith(".")) return posix.normalize(posix.join(posix.dirname(file), s));
  const parts = s.split("/");
  return s.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]!;
}

const isPath = (target: string) =>
  /^(shared|server|client|test|scripts|assets)\//.test(target) || target.startsWith("../");
const matches = (target: string, pattern: string) =>
  pattern === "*" ? isPath(target) : pattern.endsWith("/") ? target.startsWith(pattern) : target === pattern;
const covers = (file: string, patterns: string[]) => patterns.some((p) => matches(file, p));

/** Comments out, line numbers kept. */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, "")).replace(/^[ \t]*\/\/.*$/gm, "");

// ---------------------------------------------------------------- checks

const files = sources();
/** Everything oxlint reads, for the source-text rules: the app, plus test/, scripts/ and the Vite config. */
const linted = [...sources(["shared", "server", "client/src", "test", "scripts"], /\.(tsx?|mjs)$/), "vite.config.ts"];
const text = new Map(linted.map((f) => [f, readFileSync(join(ROOT, f), "utf8")]));

test("the scanner reads every kind of import", () => {
  const src = [
    'import * as THREE from "three";',
    'import type { A } from "./a.ts";',
    'import { type B, type C } from "./b.ts";',
    'import { type D, e } from "./d.ts";',
    'import f, { g } from "./f.ts";',
    "import {",
    "  h,",
    '} from "../h.ts";',
    'export { i } from "./i.ts";',
    'export type { J } from "./j.ts";',
    'export * from "./k.ts";',
    'import "./style.css";',
    'const l = () => import("./l.ts");',
    "export const m = 1;",
  ].join("\n");
  assert.deepEqual(
    importsOf(src).map((i) => [i.spec, i.line, i.typeOnly]),
    [
      ["three", 1, false],
      ["./a.ts", 2, true],
      ["./b.ts", 3, true],
      ["./d.ts", 4, false],
      ["./f.ts", 5, false],
      ["../h.ts", 6, false],
      ["./i.ts", 9, false],
      ["./j.ts", 10, true],
      ["./k.ts", 11, false],
      ["./style.css", 12, false],
      ["./l.ts", 13, false],
    ],
  );
  assert.equal(resolve("client/src/app/session.ts", "../../../server/table/commands.ts"), "server/table/commands.ts");
  assert.equal(resolve("client/src/x.ts", "three/addons/controls/OrbitControls.js"), "three");
});

test("a lint disable needs one rule and a reason", () => {
  const flagged = (line: string) => [...line.matchAll(LINT_DISABLE)].length > 0;
  assert.equal(flagged("// oxlint-disable-next-line eslint/no-console -- the CLI prints"), false);
  assert.equal(flagged("{/* oxlint-disable-next-line jsx-a11y/no-autofocus -- a menu */}"), false);
  for (const bad of [
    "// oxlint-disable-next-line eslint/no-console",
    "// oxlint-disable-next-line eslint/no-console --",
    "// oxlint-disable-next-line eslint/no-console, eslint/eqeqeq -- two",
    "// oxlint-disable-next-line",
    "// oxlint-disable-line eslint/no-console -- same line",
    "/* oxlint-disable */",
    "/* oxlint-disable eslint/no-console -- the whole file */",
    "// eslint-disable-next-line no-console",
    "// oxlint-enable eslint/no-console",
  ])
    assert.equal(flagged(bad), true, bad);
});

test("the scanner sees the real code", () => {
  assert.ok(files.length > 100, `only found ${files.length} files`);
  const session = importsOf(text.get("client/src/app/session.ts")!);
  assert.ok(session.some((i) => i.typeOnly && i.spec.endsWith("server/table/commands.ts")));
});

test("imports stay inside their boundaries", () => {
  const broken: string[] = [];
  const used = new Set<(typeof EXCEPTIONS)[number]>();
  for (const file of files) {
    if (exempt(file)) continue;
    for (const imp of importsOf(text.get(file)!)) {
      const target = resolve(file, imp.spec);
      for (const rule of RULES) {
        if (!covers(file, rule.files) || covers(file, rule.except ?? [])) continue;
        if (!covers(target, rule.forbid) || covers(target, rule.allow ?? [])) continue;
        if (rule.types && imp.typeOnly) continue;
        const known = EXCEPTIONS.find((e) => e.file === file && e.imports === target);
        if (known) {
          used.add(known);
          continue;
        }
        broken.push(`${file}:${imp.line} imports "${imp.spec}", breaking "${rule.name}": ${rule.why}`);
      }
    }
  }
  assert.equal(broken.length, 0, `\n${broken.join("\n")}\n`);
  const stale = EXCEPTIONS.filter((e) => !used.has(e));
  assert.equal(
    stale.length,
    0,
    `\n${stale.map((e) => `${e.file} no longer imports ${e.imports}: delete its entry in EXCEPTIONS (#${e.issue}).`).join("\n")}\n`,
  );
});

test("source-text rules hold", () => {
  const broken: string[] = [];
  for (const rule of TEXT_RULES) {
    for (const file of linted) {
      if ((exempt(file) && !rule.tests) || !covers(file, rule.files) || covers(file, rule.except ?? [])) continue;
      const src = text.get(file)!;
      for (const [i, line] of (rule.comments ? src : stripComments(src)).split("\n").entries()) {
        for (const m of line.matchAll(rule.pattern))
          broken.push(`${file}:${i + 1} uses "${m[0]}", breaking "${rule.name}": ${rule.why}`);
      }
    }
  }
  assert.equal(broken.length, 0, `\n${broken.join("\n")}\n`);
});
