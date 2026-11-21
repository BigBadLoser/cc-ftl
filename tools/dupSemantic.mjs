#!/usr/bin/env node
/* global process, console */
// Semantic duplicate report (#569): functions that do the same thing written differently, found by jscpd's --semantic
// mode, minus the pairs already in .jscpd-semantic-baseline.json. About a third of semantic pairs are real "one answer per
// question" breaks (#559), so this reports and never fails a build.
//
//   npm run dup:semantic          prints the new pairs as markdown; prints nothing when there are none
//   npm run dup:semantic:accept   rewrites the baseline from the current tree (accept everything reported now)
//
// Embeddings come from jscpd's local CodeRankEmbed model (downloaded once, about 550 MB) unless JSCPD_SEMANTIC_URL names an
// OpenAI-compatible embeddings server serving the same model (the agent-harness host runs one on its NPU). jscpd caches
// embeddings per function, so after the first run only new or changed code is embedded.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const BASELINE = '.jscpd-semantic-baseline.json';
const MODEL = 'nomic-ai/CodeRankEmbed';
const SNIPPET_LINES = 12;

/** jscpd arguments for a semantic run against the baseline. */
export function jscpdArgs({ out, accept = false, url = process.env.JSCPD_SEMANTIC_URL } = {}) {
  const args = ['--semantic', '--kind', 'semantic', '--baseline', BASELINE, '--reporters', 'json', '--output', out, '--silent'];
  if (url) args.push('--semantic-url', url, '--semantic-model', MODEL);
  else args.push('--semantic-download');
  if (accept) args.push('--update-baseline');
  return args;
}

// jscpd names files relative to the scanned path (`src`).
const where = (f) => `${f.name.startsWith('src/') ? '' : 'src/'}${f.name}:${f.start}-${f.end}`;

const snippet = (text) => {
  const lines = (text ?? '').split('\n');
  const head = lines.slice(0, SNIPPET_LINES).join('\n');
  return lines.length > SNIPPET_LINES ? `${head}\n…` : head;
};

/** Markdown for the pairs of a jscpd JSON report that are new against the baseline; '' when there are none. */
export function report(json) {
  const fresh = (json.duplicates ?? []).filter((d) => d.kind === 'semantic' && d.isNew);
  if (!fresh.length) return '';
  fresh.sort((a, b) => b.lines - a.lines);
  const rows = fresh.map((d) => [
    `- **${where(d.firstFile)}** and **${where(d.secondFile)}** (${d.lines} lines)`,
    '  <details><summary>first</summary>',
    '',
    '  ```ts',
    ...snippet(d.fragment).split('\n').map((l) => `  ${l}`),
    '  ```',
    '  </details>',
  ].join('\n'));
  return [
    `${fresh.length} new semantic duplicate pair${fresh.length === 1 ? '' : 's'}: code that may answer the same question twice.`,
    'For each: fold it into one owner (see "One answer per question" in `docs/ARCHITECTURE.md`), or, if the two only look alike,',
    'accept it with `npm run dup:semantic:accept` and commit the baseline.',
    '',
    ...rows,
  ].join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const accept = process.argv.includes('--accept');
  const out = mkdtempSync(join(tmpdir(), 'dup-semantic-'));
  try {
    execFileSync('node_modules/.bin/jscpd', jscpdArgs({ out, accept }), { stdio: ['ignore', 'ignore', 'inherit'] });
    if (accept) console.error(`dup:semantic: ${BASELINE} rewritten from the current tree; commit it.`);
    else {
      const md = report(JSON.parse(readFileSync(join(out, 'jscpd-report.json'), 'utf8')));
      if (md) console.log(md);
    }
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}
