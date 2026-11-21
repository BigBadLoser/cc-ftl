#!/usr/bin/env node
/* global process, console */
// The tests for a change, in two strengths.
//   node tools/testFast.mjs [--depth N]     near tests (before a commit, `npm run test:fast`): the test files within N imports
//                                           (default 2) of what changed, plus changed test files. What changed: uncommitted
//                                           files (staged, unstaged, untracked); with none, the branch against origin/main.
//   node tools/testFast.mjs --base <ref>    every affected fast test (before a push, `npm run test:branch` with origin/main):
//                                           Vitest's own `--changed` over everything since the merge base with <ref>, plus
//                                           uncommitted changes; the slow tier skipped (VITEST_FAST=1).
// Why two: most tests step the whole game, so an edit anywhere in src/sim reaches about two thirds of the fast tier through
// three imports (`npm run test:why -- <file>`). Near tests are that file's own tests and its direct users; the rest run at push
// and in CI, which stay the record. A tuning file (`tuning*.ts`) counts from the users of the constants that changed
// (tools/nearTests.mjs): any tuning edit would otherwise reach most of the fast tier. A change to vite.config.ts or src/sim/testSetup.ts runs the whole fast tier.
// Plain `vitest --changed` exits green with zero tests on a clean tree; this always says what it compared.
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { importGraph } from './importGraph.mjs';
import { nearFiles } from './nearTests.mjs';

const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();
const lines = (s) => s.split('\n').filter(Boolean);
const DEFAULT_BASE = 'origin/main';
const EVERYTHING = new Set(['vite.config.ts', 'src/sim/testSetup.ts', 'package-lock.json']);

const args = process.argv.slice(2);
const flag = (name) => {
  const at = args.indexOf(name);
  if (at < 0) return undefined;
  const v = args[at + 1];
  if (!v) { console.error(`testFast: ${name} needs a value`); process.exit(2); }
  args.splice(at, 2);
  return v;
};
const base = flag('--base');
const depth = Number(flag('--depth') ?? 2);

const has = (ref) => { try { git('rev-parse', '--verify', '--quiet', `${ref}^{commit}`); return true; } catch { return false; } };
// A sandbox worktree may have no origin/main: try one fetch, then fail with the fix (the harness check then reports it).
const verify = (ref) => {
  if (has(ref)) return;
  const m = /^origin\/(.+)$/.exec(ref);
  if (m) { try { git('fetch', '--quiet', 'origin', `${m[1]}:refs/remotes/origin/${m[1]}`); } catch { /* offline: reported below */ } }
  if (!has(ref)) { console.error(`testFast: base ${ref} not found and could not be fetched (git fetch origin main)`); process.exit(2); }
};
const vitest = (vargs, env = {}) => {
  const r = spawnSync('npx', ['vitest', 'run', '--passWithNoTests', ...vargs, ...args], { stdio: 'inherit', env: { ...process.env, ...env } });
  if (r.signal || r.error) console.error(`testFast: vitest stopped by ${r.signal ?? r.error?.message}`);
  process.exit(r.status ?? 1);
};

const untracked = lines(git('ls-files', '--others', '--exclude-standard'));
const uncommitted = [...new Set([...lines(git('diff', '--name-only', '--cached')), ...lines(git('diff', '--name-only')), ...untracked])];

// Push strength: every affected test, by Vitest's own graph.
if (base) {
  verify(base);
  const changed = new Set([...lines(git('diff', '--name-only', `${base}...HEAD`)), ...uncommitted]);
  console.log(`testFast: every affected fast test, ${changed.size} changed file(s) since ${base} (merge base) plus uncommitted`);
  const fresh = untracked.filter((f) => /\.ts$/.test(f));
  if (fresh.length) console.warn(`testFast: Vitest's --changed does not see untracked files; git add them: ${fresh.slice(0, 5).join(', ')}${fresh.length > 5 ? ', ...' : ''}`);
  vitest([`--changed=${base}`], { VITEST_FAST: '1' });
}

// Commit strength: near tests.
let changed = uncommitted;
let what = 'uncommitted';
let baseRef = 'HEAD'; // what `changed` is compared against: the last commit, or the merge base for a branch
if (!changed.length) {
  verify(DEFAULT_BASE);
  changed = lines(git('diff', '--name-only', `${DEFAULT_BASE}...HEAD`));
  what = `on the branch since ${DEFAULT_BASE} (nothing uncommitted)`;
  baseRef = git('merge-base', DEFAULT_BASE, 'HEAD');
}
if (changed.some((f) => EVERYTHING.has(f))) {
  console.log(`testFast: ${changed.filter((f) => EVERYTHING.has(f)).join(', ')} changed: the whole fast tier`);
  vitest([], { VITEST_FAST: '1' });
}
const g = importGraph();
const atBase = (f) => { try { return execFileSync('git', ['show', `${baseRef}:${f}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return null; } };
const now = (f) => (existsSync(f) ? readFileSync(f, 'utf8') : null); // the working tree: on a clean tree that is HEAD
const { files: reached, followed } = nearFiles(g, changed, depth, atBase, now);
for (const [f, names] of followed) console.log(`testFast: ${f}: ${names == null ? 'the whole file (a change not pinned to its exports)' : names.length ? `the users of ${names.join(', ')}` : 'no constant changed'}`);
const near = [...reached].filter((f) => /\.test\.ts$/.test(f) && !/\.soak\.test\.ts$/.test(f))
  .filter((f) => !/\.slow\.test\.ts$/.test(f) || changed.includes(f)) // a slow test runs only when it was edited itself
  .sort();
const all = g.files.filter((f) => /\.test\.ts$/.test(f) && !/\.(slow|soak)\.test\.ts$/.test(f)).length;
console.log(`testFast: near tests (within ${depth} imports) of ${changed.length} file(s) ${what}: ${near.length} test file(s); every affected test runs at push (npm run check:push) and in CI`);
if (!near.length) { console.log('testFast: no tests to run'); process.exit(0); }
if (near.length > all / 3) console.log(`testFast: that is ${near.length} of ${all} fast files; npm run test:why -- <file> shows the import chains`);
vitest(near);
