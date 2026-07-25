import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

function git(...args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }).trim();
}

git("fetch", "--tags", "--force", "origin");

const existingTags = git("tag", "--list", "v[0-9]*");
if (existingTags) {
  console.log("A semantic version baseline tag already exists.");
  process.exit(0);
}

const { version } = JSON.parse(readFileSync("package.json", "utf8"));
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error(`package.json contains an invalid baseline version: ${version}`);
}

let target = "HEAD";
try {
  target = git("rev-parse", "HEAD^");
} catch {
  console.warn("No parent commit exists; the baseline tag will point to HEAD.");
}

const tag = `v${version}`;
git("tag", tag, target);
execFileSync("git", ["push", "origin", tag], { stdio: "inherit" });
console.log(`Created baseline tag ${tag} at ${target}.`);
