/**
 * Refuse a commit whose package.json and package-lock.json disagree — the
 * drift that broke `npm ci` once. Run by `.husky/pre-commit`.
 *
 * Compares the *staged* versions of both files, not the working tree: what
 * matters is what lands in the commit. Only the declared dependency ranges are
 * compared, against the lockfile's root entry (`packages[""]`), which is what
 * `npm ci` checks before it installs anything. A staged script or config
 * change in package.json with no dependency change passes untouched.
 *
 * Exit 0 when they agree, or when package.json is not staged. Exit 1 with the
 * mismatches listed otherwise.
 */
import { execFileSync } from "node:child_process";

const FIELDS = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"];

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" });
}

function staged(path) {
  return JSON.parse(git("show", `:${path}`));
}

const stagedFiles = git("diff", "--cached", "--name-only").split("\n");
if (!stagedFiles.includes("package.json")) process.exit(0);

const pkg = staged("package.json");
const root = staged("package-lock.json").packages?.[""] ?? {};

const problems = [];
for (const field of FIELDS) {
  const declared = pkg[field] ?? {};
  const locked = root[field] ?? {};
  for (const name of new Set([...Object.keys(declared), ...Object.keys(locked)])) {
    if (declared[name] !== locked[name]) {
      problems.push(`${field}.${name}: package.json ${declared[name] ?? "(absent)"}, lockfile ${locked[name] ?? "(absent)"}`);
    }
  }
}

if (problems.length > 0) {
  console.error("pre-commit: package.json and package-lock.json disagree:");
  for (const p of problems) console.error(`  - ${p}`);
  console.error("Run `npm install`, then stage package-lock.json as well.");
  process.exit(1);
}
