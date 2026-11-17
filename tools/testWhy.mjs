#!/usr/bin/env node
/* global process, console */
// Why does an edit to a file select so many tests? Vitest's `--changed`/`related` runs every test file that reaches the
// edited file through value imports (`import type` is erased and does not count). This walks the same graph from source.
//   npm run test:why -- <file>...            how many fast test files an edit selects, grouped by the edited file's
//                                            direct importer each one's shortest chain goes through
//   npm run test:why -- <file> --chains      also print each selected test's shortest import chain
//   npm run test:why -- --top [n]            the n source files (default 25) that the most fast test files reach
// Add --all to count the slow and soak tiers too. The graph is tools/importGraph.mjs (a source read, close to Vitest's
// selection, not exact); use the counts to find wide import chains, not as a gate.
import { relative, resolve } from 'node:path';
import { importGraph, isTestFile } from './importGraph.mjs';

const ROOT = process.cwd();
const { files, known, reach, chain } = importGraph(ROOT);

const args = process.argv.slice(2);
const all = args.includes('--all');
const isTest = (f) => isTestFile(f, all);
const tests = files.filter(isTest);

if (args.includes('--top')) {
  const n = Number(args[args.indexOf('--top') + 1]) || 25;
  const rows = files.filter((f) => !/\.test\.ts$/.test(f)).map((f) => [f, [...reach([f]).keys()].filter(isTest).length]);
  rows.sort((a, b) => b[1] - a[1]);
  console.log(`fast test files: ${tests.length}${all ? ' (all tiers)' : ''}; source files most tests reach:`);
  for (const [f, c] of rows.slice(0, n)) console.log(`${String(c).padStart(5)}  ${f}`);
  process.exit(0);
}

const targets = args.filter((a) => !a.startsWith('--')).map((a) => relative(ROOT, resolve(a)));
if (!targets.length) {
  console.error('usage: testWhy.mjs <file>... [--chains] [--all] | --top [n] [--all]');
  process.exit(2);
}
for (const t of targets) if (!known.has(t)) { console.error(`testWhy: ${t} is not in the graph`); process.exit(2); }
const prev = reach(targets);
const hit = [...prev.keys()].filter(isTest).sort();
console.log(`${targets.join(', ')}: ${hit.length} of ${tests.length} ${all ? '' : 'fast '}test files`);
const via = new Map();
for (const f of hit) {
  const c = chain(prev, f);
  const hop = c.length > 2 ? c[c.length - 2] : '(imports it directly)';
  via.set(hop, (via.get(hop) ?? 0) + 1);
}
console.log('by direct importer (shortest chain):');
for (const [h, c] of [...via].sort((a, b) => b[1] - a[1])) console.log(`${String(c).padStart(5)}  ${h}`);
if (args.includes('--chains')) for (const f of hit) console.log(chain(prev, f).join(' <- '));
