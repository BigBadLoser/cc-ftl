/* global process, performance */
// Detector adapters. Each one runs a tool over a tree and returns pairs: { a: {file, start, end}, b: {file, start, end}, score? },
// files relative to the tree root (`src/...`), lines 1-based. A detector run is { id, pairs, seconds } or { id, skipped }.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { functionStartingAt, REPO } from './tree.mjs';

const JSCPD = join(REPO, 'node_modules/.bin/jscpd');
const SIMILARITY = process.env.DUPBENCH_SIMILARITY_TS ?? join(homedir(), '.cargo/bin/similarity-ts');
/** A directory with eslint, typescript-eslint and eslint-plugin-sonarjs installed (not a dependency of the repo). */
const SONAR_DIR = process.env.DUPBENCH_SONAR_DIR;
const HTTP_URL = process.env.DUPBENCH_SEMANTIC_URL;
const HTTP_MODELS = HTTP_URL ? (process.env.DUPBENCH_SEMANTIC_MODELS ?? '').split(',').filter(Boolean) : [];

const timed = (fn) => {
  const t0 = performance.now();
  const pairs = fn();
  return { pairs, seconds: (performance.now() - t0) / 1000 };
};

// jscpd names files relative to the scanned path (`src`).
const srcName = (n) => (n.startsWith('src/') ? n : `src/${n}`);

function jscpd(root, args) {
  const out = mkdtempSync(join(tmpdir(), 'dupbench-jscpd-'));
  try {
    execFileSync(JSCPD, [...args, '--reporters', 'json', '--output', out, '--silent'], { cwd: root, stdio: ['ignore', 'ignore', 'inherit'], maxBuffer: 1 << 28 });
    const json = JSON.parse(readFileSync(join(out, 'jscpd-report.json'), 'utf8'));
    return json.duplicates.map((d) => ({
      a: { file: srcName(d.firstFile.name), start: d.firstFile.start, end: d.firstFile.end },
      b: { file: srcName(d.secondFile.name), start: d.secondFile.start, end: d.secondFile.end },
      score: d.similarity ?? d.score,
    }));
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}

/** similarity-ts prints "Similarity: 85.66% ..." and then two "file:start-end name" lines per pair. */
export function parseSimilarityTs(text) {
  const pairs = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = /^Similarity: ([\d.]+)%/.exec(lines[i]);
    if (!m) continue;
    const loc = (l) => {
      const x = /^\s+(\S+?):(\d+)-(\d+)\s/.exec(l ?? '');
      return x ? { file: x[1], start: +x[2], end: +x[3] } : null;
    };
    const a = loc(lines[i + 1]), b = loc(lines[i + 2]);
    if (a && b) pairs.push({ a, b, score: +m[1] / 100 });
  }
  return pairs;
}

function similarityTs(root, threshold) {
  const r = spawnSync(SIMILARITY, ['src', '-t', String(threshold), '-m', '6', '--no-types'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 29 });
  if (r.error) throw r.error;
  return parseSimilarityTs(r.stdout);
}

/** sonarjs/no-identical-functions through eslint: reports the later function and names the line of the earlier one (same file only). */
function sonar(root, files) {
  const cfg = join(SONAR_DIR, 'eslint.config.mjs');
  const out = join(root, 'sonar.json');
  spawnSync(join(SONAR_DIR, 'node_modules/.bin/eslint'), ['--no-inline-config', '-c', cfg, '--format', 'json', '-o', out, ...files], { cwd: root, encoding: 'utf8' });
  const pairs = [];
  for (const f of JSON.parse(readFileSync(out, 'utf8'))) {
    const file = f.filePath.slice(root.length + 1);
    for (const m of f.messages) {
      const earlier = /on line (\d+)/.exec(m.message)?.[1];
      if (!m.ruleId?.startsWith('sonarjs/') || !earlier) continue;
      // The rule reports only the function's name line: widen both ends to their whole functions.
      const whole = (line) => functionStartingAt(join(root, file), line) ?? { start: line, end: line };
      pairs.push({ a: { file, ...whole(+earlier) }, b: { file, ...whole(m.line) } });
    }
  }
  return pairs;
}

/** The detector list. `semantic` ones keep every pair down to a low cutoff so the report can re-cut them. */
export function detectors({ only } = {}) {
  const list = [
    { id: 'jscpd-exact', batched: true, run: (root) => jscpd(root, []) },
    { id: 'jscpd-renamed', batched: true, run: (root) => jscpd(root, ['--kind', 'renamed', '--ignore-identifiers']) },
    { id: 'jscpd-renamed+lit', batched: true, run: (root) => jscpd(root, ['--kind', 'renamed', '--ignore-identifiers', '--ignore-literals']) },
    ...[0.6, 0.7, 0.8, 0.9].map((x) => ({ id: `jscpd-ast-${x}`, run: (root) => jscpd(root, ['--kind', 'ast', '--similarity', String(x)]) })),
    // One run at the lowest threshold; the report re-cuts it at the higher ones.
    { id: 'similarity-ts', sweep: [0.7, 0.75, 0.8, 0.85, 0.9], run: (root) => similarityTs(root, 0.7), enabled: () => existsSync(SIMILARITY) },
    { id: 'sonarjs-crossfile', run: (root) => sonar(root, ['src/**/*.ts']), enabled: () => !!SONAR_DIR },
    // The rule never looks across files, so this one gets each planted function appended into its original's file.
    { id: 'sonarjs-samefile', tree: 'combined', run: (root) => sonar(root, ['src/**/*.ts']), enabled: () => !!SONAR_DIR },
    {
      id: 'jscpd-semantic',
      sweep: [0.4, 0.5, 0.6375, 0.7, 0.8],
      run: (root) => jscpd(root, ['--semantic', '--kind', 'semantic', '--semantic-same-threshold', '0.4', '--semantic-download']),
    },
    // Other embedding models over an OpenAI-compatible API (e.g. Ollama): DUPBENCH_SEMANTIC_URL=http://127.0.0.1:11434/v1
    // DUPBENCH_SEMANTIC_MODELS=a,b. Score scales differ by model, so these sweep wide from a low cutoff.
    ...HTTP_MODELS.map((model) => ({
      id: `semantic-${model.replace(/[^a-z0-9.]+/gi, '_')}`,
      sweep: [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.825, 0.85, 0.875, 0.9],
      run: (root) => jscpd(root, ['--semantic', '--kind', 'semantic', '--semantic-url', HTTP_URL, '--semantic-model', model, '--semantic-same-threshold', '0.3']),
    })),
  ];
  return list.filter((d) => (!only || only.some((o) => d.id.startsWith(o))) && (d.enabled?.() ?? true));
}

/** Run one detector; a missing tool or a crash becomes `{ id, skipped }` so the rest of the bench still reports. */
export function runDetector(d, root) {
  try {
    return { id: d.id, ...timed(() => d.run(root)) };
  } catch (e) {
    return { id: d.id, skipped: String(e.message ?? e).split('\n')[0] };
  }
}
export { timed };
