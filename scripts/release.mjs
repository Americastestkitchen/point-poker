#!/usr/bin/env node
// Ship whatever is on develop to production, in one command:
//   1. merge develop into main
//   2. run the checks
//   3. bump the version and tag it (v1.2.3)
//   4. push. GitHub Actions then deploys production and publishes the release
//   5. merge main back into develop so they stay level
//
//   npm run release            -> patch (0.1.0 -> 0.1.1)
//   npm run release -- minor   -> 0.1.0 -> 0.2.0
//   npm run release -- major   -> 0.1.0 -> 1.0.0
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

if (sh("git status --porcelain")) fail("You have uncommitted changes. Commit or stash them first.");
const startBranch = sh("git rev-parse --abbrev-ref HEAD");

run("git fetch origin");
const ahead = sh("git rev-list --count origin/develop..develop");
if (ahead !== "0") fail(`Your local develop has ${ahead} commit(s) that aren't pushed. Push develop first, so what you release is what you tested on the dev site.`);
if (sh("git rev-list --count origin/develop..origin/main") !== "0") fail("main has commits that develop doesn't. Merge main into develop first.");
if (sh("git rev-list --count origin/main..origin/develop") === "0") fail("Nothing to release: main already has everything on develop.");

run("git switch main");
run("git merge --ff-only origin/main");
run("git merge --ff-only origin/develop");
run("npm run check");
run(`npm version ${bump} -m "Release v%s"`);
run("git push origin main --follow-tags");
run("git switch develop");
run("git merge --ff-only origin/develop");
run("git merge --ff-only main");
run("git push origin develop");
if (startBranch !== "develop") run(`git switch ${startBranch}`);

const { version } = JSON.parse(readFileSync("package.json", "utf8"));
console.log(`\n✔ Tagged v${version}. GitHub is now deploying production and publishing the release:`);
console.log("  " + sh("gh repo view --json url -q .url") + "/actions");
