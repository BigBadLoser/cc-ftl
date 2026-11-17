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
// and in CI, which stay the record. A change to vite.config.ts or src/sim/testSetup.ts runs the whole fast tier.
// Plain `vitest --changed` exits green with zero tests on a clean tree; this always says what it compared.
import { execFileSync, spawnSync } from 'node:child_process';
import { importGraph } from './importGraph.mjs';

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

const verify = (ref) => {
  try { git('rev-parse', '--verify', '--quiet', `${ref}^{commit}`); } catch { console.error(`testFast: base ${ref} not found (git fetch origin main?)`); process.exit(2); }
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
if (!changed.length) {
  verify(DEFAULT_BASE);
  changed = lines(git('diff', '--name-only', `${DEFAULT_BASE}...HEAD`));
  what = `on the branch since ${DEFAULT_BASE} (nothing uncommitted)`;
}
if (changed.some((f) => EVERYTHING.has(f))) {
  console.log(`testFast: ${changed.filter((f) => EVERYTHING.has(f)).join(', ')} changed: the whole fast tier`);
  vitest([], { VITEST_FAST: '1' });
}
const g = importGraph();
const inGraph = changed.filter((f) => g.known.has(f));
const near = [...g.reach(inGraph, depth).keys()].filter((f) => /\.test\.ts$/.test(f) && !/\.soak\.test\.ts$/.test(f))
  .filter((f) => !/\.slow\.test\.ts$/.test(f) || changed.includes(f)) // a slow test runs only when it was edited itself
  .sort();
const all = g.files.filter((f) => /\.test\.ts$/.test(f) && !/\.(slow|soak)\.test\.ts$/.test(f)).length;
console.log(`testFast: near tests (within ${depth} imports) of ${changed.length} file(s) ${what}: ${near.length} test file(s); every affected test runs at push (npm run check:push) and in CI`);
if (!near.length) { console.log('testFast: no tests to run'); process.exit(0); }
if (near.length > all / 3) console.log(`testFast: that is ${near.length} of ${all} fast files; npm run test:why -- <file> shows the import chains`);
vitest(near);
