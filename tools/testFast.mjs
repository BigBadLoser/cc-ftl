#!/usr/bin/env node
/* global process, console */
// Fast-tier tests affected by a change (Vitest's import graph), slow tier skipped (VITEST_FAST=1).
//   node tools/testFast.mjs                 uncommitted changes (staged + unstaged); with none, the branch against origin/main
//   node tools/testFast.mjs --base <ref>    everything since the merge base with <ref>, plus uncommitted changes
// `npm run test:fast` is the first form (before a commit), `npm run test:branch` the second with origin/main (before a push).
// Plain `vitest --changed` exits green with zero tests on a clean tree, so a committed branch looked tested when nothing ran;
// this says what it compares and falls back to the branch base. Vitest never sees untracked files: `git add` new ones first.
import { execFileSync, spawnSync } from 'node:child_process';

const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();
const lines = (s) => s.split('\n').filter(Boolean);
const DEFAULT_BASE = 'origin/main';

const args = process.argv.slice(2);
const at = args.indexOf('--base');
let base = at >= 0 ? args[at + 1] : undefined;
if (at >= 0 && !base) {
  console.error('testFast: --base needs a ref');
  process.exit(2);
}
const rest = at >= 0 ? args.filter((_, i) => i !== at && i !== at + 1) : args;

const uncommitted = [...new Set([...lines(git('diff', '--name-only', '--cached')), ...lines(git('diff', '--name-only'))])];
const untracked = lines(git('ls-files', '--others', '--exclude-standard')).filter((f) => /\.(ts|svelte|js|mjs)$/.test(f));
if (untracked.length) console.warn(`testFast: ${untracked.length} untracked source file(s) are invisible to --changed; git add them: ${untracked.slice(0, 5).join(', ')}${untracked.length > 5 ? ', ...' : ''}`);

if (!base && !uncommitted.length) {
  base = DEFAULT_BASE;
  console.log(`testFast: no uncommitted changes, testing the branch against ${base}`);
}
let changed = uncommitted;
if (base) {
  try {
    git('rev-parse', '--verify', '--quiet', `${base}^{commit}`);
  } catch {
    console.error(`testFast: base ${base} not found (git fetch origin main?)`);
    process.exit(2);
  }
  changed = [...new Set([...lines(git('diff', '--name-only', `${base}...HEAD`)), ...uncommitted])];
}
console.log(`testFast: ${changed.length} changed file(s) ${base ? `since ${base} (merge base) plus uncommitted` : 'uncommitted'}`);
if (!changed.length) console.log('testFast: nothing changed, no tests to run');

const vitestArgs = ['vitest', 'run', base ? `--changed=${base}` : '--changed', '--passWithNoTests', ...rest];
const r = spawnSync('npx', vitestArgs, { stdio: 'inherit', env: { ...process.env, VITEST_FAST: '1' } });
if (r.signal || r.error) console.error(`testFast: vitest stopped by ${r.signal ?? r.error?.message}`);
process.exit(r.status ?? 1);
