#!/usr/bin/env node
/* global process, console */
// Why does an edit to a file select so many tests? Vitest's `--changed`/`related` runs every test file that reaches the
// edited file through value imports (`import type` is erased and does not count). This walks the same graph from source.
//   npm run test:why -- <file>...            how many fast test files an edit selects, grouped by the edited file's
//                                            direct importer each one's shortest chain goes through
//   npm run test:why -- <file> --chains      also print each selected test's shortest import chain
//   npm run test:why -- --top [n]            the n source files (default 25) that the most fast test files reach
// Add --all to count the slow and soak tiers too. The graph is read with a regex, not Vite's resolver: relative imports
// only (packages and the `$lib` alias are skipped), extensionless paths tried as .ts, .svelte.ts, .svelte, .js, /index.ts.
// Counts match `vitest related` closely, not exactly; use them to find wide import chains, not as a gate.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const ROOT = process.cwd();
const ROOTS = ['src', 'test', 'tools'];
const SKIP = new Set(['node_modules', 'dist', 'blender', 'layout']);
const EXT = ['', '.ts', '.svelte.ts', '.svelte', '.js', '.mjs', '/index.ts'];

const files = [];
const walk = (d) => {
  if (!existsSync(d)) return;
  for (const e of readdirSync(d)) {
    if (SKIP.has(e)) continue;
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|svelte|js|mjs)$/.test(e)) files.push(relative(ROOT, p));
  }
};
ROOTS.forEach((r) => walk(join(ROOT, r)));
const known = new Set(files);

// Value imports only: `import type`/`export type` lines are erased by the compiler, so Vitest never follows them.
const IMPORT = /(?:^|[;\n])\s*(import|export)\s+(type\s+)?(?:[\w*{}\s,$]+?\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
const deps = new Map(); // file -> files it imports
for (const f of files) {
  const text = readFileSync(join(ROOT, f), 'utf8');
  const out = new Set();
  for (const m of text.matchAll(IMPORT)) {
    if (m[2]) continue;
    const spec = m[3] ?? m[4];
    if (!spec?.startsWith('.')) continue;
    const base = relative(ROOT, resolve(ROOT, dirname(f), spec.replace(/\?.*$/, '')));
    const hit = EXT.map((x) => base + x).find((c) => known.has(c));
    if (hit) out.add(hit);
  }
  deps.set(f, out);
}
const importers = new Map(files.map((f) => [f, []]));
for (const [f, ds] of deps) for (const d of ds) importers.get(d).push(f);

const args = process.argv.slice(2);
const all = args.includes('--all');
const isTest = (f) => /\.test\.ts$/.test(f) && (all || !/\.(slow|soak)\.test\.ts$/.test(f));
const tests = files.filter(isTest);

/** Breadth-first over importers from `start`: every reached file with the file it was reached from. */
const reach = (start) => {
  const prev = new Map(start.map((s) => [s, null]));
  const queue = [...start];
  while (queue.length) {
    const f = queue.shift();
    for (const i of importers.get(f) ?? []) if (!prev.has(i)) { prev.set(i, f); queue.push(i); }
  }
  return prev;
};
const chain = (prev, f) => { const c = []; for (let x = f; x != null; x = prev.get(x)) c.push(x); return c; };

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
