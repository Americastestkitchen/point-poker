#!/usr/bin/env node
// Ship what's on main to production, in one command:
//   1. run the checks
//   2. bump the version and tag it (v1.2.3)
//   3. push. GitHub Actions then deploys production and publishes the release
//
//   npm run release            -> patch (0.2.0 -> 0.2.1)
//   npm run release -- minor   -> 0.2.0 -> 0.3.0
//   npm run release -- major   -> 0.2.0 -> 1.0.0
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const bump = process.argv[2] ?? "patch";
if (!["patch", "minor", "major"].includes(bump)) {
  console.error(`Unknown bump "${bump}". Use patch, minor or major.`);
  process.exit(1);
}
const sh = (cmd) => execSync(cmd, { stdio: ["ignore", "pipe", "inherit"] }).toString().trim();
const run = (cmd) => { console.log(`\n$ ${cmd}`); execSync(cmd, { stdio: "inherit" }); };
const fail = (msg) => { console.error(`\n✖ ${msg}`); process.exit(1); };

if (sh("git rev-parse --abbrev-ref HEAD") !== "main") fail("Releases are cut from main. Run `git switch main` first.");
if (sh("git status --porcelain")) fail("You have uncommitted changes. Commit or stash them first.");
run("git fetch origin");
const ahead = sh("git rev-list --count origin/main..main");
if (ahead !== "0") fail(`You have ${ahead} commit(s) on main that aren't pushed. Push first, so what you release is what you tried on the dev site.`);
run("git merge --ff-only origin/main");
const lastTag = sh("git describe --tags --abbrev=0 2>/dev/null || true");
if (lastTag && sh(`git rev-list --count ${lastTag}..HEAD`) === "0") fail(`Nothing to release: main hasn't changed since ${lastTag}.`);

run("npm run check");
run(`npm version ${bump} -m "Release v%s"`);
run("git push origin main --follow-tags");

const { version } = JSON.parse(readFileSync("package.json", "utf8"));
console.log(`\n✔ Tagged v${version}. GitHub is now deploying production and publishing the release:`);
console.log("  " + sh("gh repo view --json url -q .url") + "/actions");
