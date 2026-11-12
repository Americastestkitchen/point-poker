#!/usr/bin/env node
// Cut a release: bump the version on main, tag it, and push.
// GitHub Actions then deploys production and publishes the GitHub Release.
//
//   npm run release            -> patch (0.1.0 -> 0.1.1)
//   npm run release -- minor   -> 0.1.0 -> 0.2.0
//   npm run release -- major   -> 0.1.0 -> 1.0.0
import { execSync } from "node:child_process";

const bump = process.argv[2] ?? "patch";
if (!["patch", "minor", "major"].includes(bump)) {
  console.error(`Unknown bump "${bump}". Use patch, minor or major.`);
  process.exit(1);
}
const sh = (cmd) => execSync(cmd, { stdio: ["ignore", "pipe", "inherit"] }).toString().trim();
const run = (cmd) => execSync(cmd, { stdio: "inherit" });

if (sh("git rev-parse --abbrev-ref HEAD") !== "main") {
  console.error("Releases are cut from main. Merge develop into main first (see CONTRIBUTING.md).");
  process.exit(1);
}
if (sh("git status --porcelain")) {
  console.error("Working tree isn't clean. Commit or stash first.");
  process.exit(1);
}
run("git pull --ff-only origin main");
run("npm run check");
run(`npm version ${bump} -m "Release v%s"`);
run("git push origin main --follow-tags");
const version = JSON.parse(sh("cat package.json")).version;
console.log(`\nTagged v${version}. GitHub Actions is now deploying production and publishing the release:`);
console.log(sh("gh repo view --json url -q .url") + "/actions");
