#!/usr/bin/env node
/* global process, console */
// Rewrites tools/testWeights.ts (seconds per test file) so the sequencer in vitest.sequencer.ts can start the longest files
// first and balance the CI shards. Weights should come from CI, whose runners are what the split is for; a local run is
// slower or faster by a different factor per file.
//   npm run test:weights:ci [-- run-id]        (node tools/testWeights.mjs --ci [run-id]) download the per-shard JSON reports (artifact "vitest-times-*") of a CI run
//                                              (default: the latest successful ci.yml run on main) and merge them
//   node tools/testWeights.mjs a.json b.json   merge Vitest JSON reports (a directory means every .json inside it)
//   node tools/testWeights.mjs a.txt           lines of "<ms> <tests> <path>" (a parsed job log)
//   npm run test:weights                       a local full run, then the first form with its report
// The reports are MERGED into the weights already there: a file in a report overwrites its entry, a file missing from the
// reports (a partial run, e.g. tests=affected) keeps its old weight, and an entry whose file no longer exists is dropped.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';

const args = process.argv.slice(2);
const gh = (...a) => execFileSync('gh', a, { encoding: 'utf8' }).trim();

// A nightly no-op run succeeds without running the test shards and so has no timing artifacts: walk back to the first
// successful run on main whose shards 1..N all uploaded one (and have not expired). Push and schedule runs are full suites;
// a manual run may have been `affected` (a subset), so those come last.
function latestRunWithTimes() {
  const runs = JSON.parse(gh('run', 'list', '--workflow=ci.yml', '--branch=main', '--status=success', '--limit=20', '--json=databaseId,event'));
  runs.sort((a, b) => Number(a.event === 'workflow_dispatch') - Number(b.event === 'workflow_dispatch'));
  for (const { databaseId } of runs) {
    const arts = JSON.parse(gh('api', `repos/{owner}/{repo}/actions/runs/${databaseId}/artifacts?per_page=100`, '--jq=[.artifacts[]|select(.expired|not)|.name]|tojson'));
    const shards = new Set(arts.flat().map((n) => /^vitest-times-(\d+)$/.exec(n)?.[1]).filter(Boolean).map(Number));
    const top = Math.max(0, ...shards);
    if (top > 0 && shards.size === top) return String(databaseId);
  }
  console.error('no successful ci.yml run on main among the last 20 has a full set of vitest-times-* artifacts; pass a run id');
  process.exit(1);
}
const secs = {};
// Report paths are absolute on the machine that ran them (a CI runner's /home/runner/work/x/x/src/...): make them repo-relative.
const repoPath = (name) => {
  const rel = relative(process.cwd(), resolve(name)).replaceAll('\\', '/');
  if (!rel.startsWith('..')) return rel;
  const m = /\/((?:src|tools)\/.*)$/.exec(name.replaceAll('\\', '/'));
  return m ? m[1] : rel;
};
const add = (path, s) => {
  if (!Number.isFinite(s)) return; // a skipped or unreadable file has no time
  secs[path] = Math.round(Math.max(0.1, s) * 10) / 10;
};

let inputs = args.filter((a) => a !== '--ci');
if (args.includes('--ci')) {
  const dir = mkdtempSync(join(tmpdir(), 'ci-times-'));
  // Only a numeric first argument is a run id; anything else is a report to merge alongside the download.
  let run = /^\d+$/.test(inputs[0] ?? '') ? inputs[0] : undefined;
  if (run) inputs = inputs.slice(1);
  else run = latestRunWithTimes();
  execFileSync('gh', ['run', 'download', run, '--pattern', 'vitest-times-*', '--dir', dir], { stdio: 'inherit' });
  inputs.push(dir);
  console.log(`weights from CI run ${run}`);
}
if (!inputs.length) {
  console.error('usage: testWeights.mjs --ci [run-id] | <report.json|dir|times.txt>...');
  process.exit(1);
}

const files = [];
const walk = (p) => {
  if (statSync(p).isDirectory()) for (const e of readdirSync(p)) walk(join(p, e));
  else files.push(p);
};
inputs.forEach(walk);

for (const p of files) {
  const text = readFileSync(p, 'utf8');
  if (p.endsWith('.json')) {
    let report;
    try {
      report = JSON.parse(text);
    } catch {
      console.warn(`skipping ${p}: not valid JSON`);
      continue;
    }
    for (const f of Array.isArray(report?.testResults) ? report.testResults : []) add(repoPath(f.name), typeof f.startTime === 'number' && typeof f.endTime === 'number' ? (f.endTime - f.startTime) / 1000 : NaN);
  } else {
    for (const line of text.split('\n')) {
      const m = /^(\d+)\s+\d+\s+(\S+)/.exec(line);
      if (m) add(repoPath(m[2]), Number(m[1]) / 1000);
    }
  }
}

if (Object.keys(secs).length === 0) {
  console.error('no file times found in the inputs; weights left as they are');
  process.exit(1);
}
const target = resolve('tools/testWeights.ts');
let old = {};
try {
  old = JSON.parse(/export default (\{[\s\S]*\}) as Record/.exec(readFileSync(target, 'utf8'))[1]);
} catch {
  console.warn('could not read the existing weights; writing the reports alone');
}
const kept = Object.entries(old).filter(([f]) => !(f in secs) && existsSync(resolve(f)));
const merged = { ...Object.fromEntries(kept), ...Object.fromEntries(Object.entries(secs).filter(([f]) => existsSync(resolve(f)))) };
const sorted = Object.fromEntries(Object.entries(merged).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)));
writeFileSync(target, `// Generated by tools/testWeights.mjs (npm run test:weights:ci): seconds per test file, used by vitest.sequencer.ts.\nexport default ${JSON.stringify(sorted, null, 1)} as Record<string, number>;\n`);
console.log(`wrote ${Object.keys(sorted).length} weights: ${Object.keys(sorted).length - kept.length} from the reports, ${kept.length} kept from before; dropped ${Object.keys(old).length - kept.length - Object.keys(old).filter((f) => f in secs).length} old entries for missing files`);
