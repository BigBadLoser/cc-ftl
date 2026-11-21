#!/usr/bin/env node
/* global process, console */
// Duplicate-detector benchmark (#610). Plants labelled copies (tools/dupBench/cases) into a temp copy of src, runs every detector
// once over it and once over a clean copy, and reports recall per rewrite level, false positives on lookalikes and noise.
//
//   node tools/dupBench/run.mjs --out results.json [--only jscpd,similarity-ts] [--keep]
//
// Optional tools: similarity-ts (DUPBENCH_SIMILARITY_TS, default ~/.cargo/bin/similarity-ts), eslint-plugin-sonarjs
// (DUPBENCH_SONAR_DIR: a directory with eslint, typescript-eslint and the plugin installed, plus an eslint.config.mjs enabling
// sonarjs/no-identical-functions), and jscpd's semantic model (jscpd downloads it once, about 550 MB).
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detectors, runDetector } from './detectors.mjs';
import { markdown, scoreSetting } from './score.mjs';
import { buildCombinedTree, buildTree, caseRanges, loadCases } from './tree.mjs';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : undefined);
const only = value('only')?.split(',');
const out = value('out');

const cases = loadCases();
// A fixed path, so jscpd's per-path embedding cache survives from one run to the next (a cold semantic run takes minutes).
const base = join(tmpdir(), 'dupbench');
rmSync(base, { recursive: true, force: true });
mkdirSync(base);
const dirs = { planted: join(base, 'planted'), clean: join(base, 'clean'), combined: join(base, 'combined') };
for (const d of Object.values(dirs)) mkdirSync(d);

buildTree(dirs.planted, cases);
buildTree(dirs.clean);
const ranges = { tree: new Map(cases.map((c) => [c.id, caseRanges(dirs.planted, c)])) };
let combinedBuilt = false;
const combined = () => {
  if (!combinedBuilt) ranges.combined = buildCombinedTree(dirs.combined, cases);
  combinedBuilt = true;
};

// Token-clone detectors report each clone once, against the first copy they saw, so copies of one original planted together
// steal each other's pairs. They run once per level instead, each tree holding one planted variant of every original.
const batchDirs = {};
function runBatched(d) {
  const byLevel = {};
  let seconds = 0;
  for (const level of new Set(cases.map((c) => c.level))) {
    if (!batchDirs[level]) {
      batchDirs[level] = join(base, `level-${level}`);
      mkdirSync(batchDirs[level]);
      buildTree(batchDirs[level], cases.filter((c) => c.level === level));
    }
    const r = runDetector(d, batchDirs[level]);
    if (r.skipped) return r;
    byLevel[level] = r.pairs;
    seconds += r.seconds;
  }
  return { id: d.id, pairs: Object.values(byLevel).flat(), byLevel, seconds: seconds / Object.keys(byLevel).length };
}

const rows = [], skipped = [];
try {
  for (const d of detectors({ only })) {
    const mode = d.tree ?? 'tree';
    if (mode === 'combined') combined();
    console.error(`running ${d.id} ...`);
    const planted = d.batched ? runBatched(d) : runDetector(d, mode === 'combined' ? dirs.combined : dirs.planted);
    if (planted.skipped) {
      skipped.push(planted);
      continue;
    }
    const clean = runDetector(d, dirs.clean);
    if (clean.skipped) {
      skipped.push(clean);
      continue;
    }
    for (const cut of d.sweep ?? [undefined]) rows.push(scoreSetting({ id: d.id, cut, planted, clean, cases, ranges: ranges[mode] }));
  }
  const md = markdown(rows, cases, skipped);
  console.log(md);
  if (out) writeFileSync(out, JSON.stringify({ rows, skipped, cases: cases.map((c) => c.id) }, null, 2));
} finally {
  if (!flag('keep')) rmSync(base, { recursive: true, force: true });
  else console.error(`kept ${base}`);
}
