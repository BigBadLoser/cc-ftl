/* global process */
// The repo's value-import graph, read from source (used by testWhy.mjs and testFast.mjs). It mirrors what Vitest follows for
// `--changed`/`related`: value imports, re-exports, dynamic `import()` and `import.meta.glob` patterns; `import type` and
// `export type` are erased by the compiler and do not count. Relative paths only (packages and the `$lib` alias are skipped);
// extensionless paths are tried as .ts, .svelte.ts, .svelte, .js, .mjs and /index.ts. A regex read, not Vite's resolver: close
// to Vitest's selection, not exact.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const ROOTS = ['src', 'test', 'tools'];
const SKIP = new Set(['node_modules', 'dist', 'blender', 'layout']);
const EXT = ['', '.ts', '.svelte.ts', '.svelte', '.js', '.mjs', '/index.ts'];
const IMPORT = /(?:^|[;\n])\s*(import|export)\s+(type\s+)?(?:[\w*{}\s,$]+?\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
const GLOB = /import\.meta\.glob(?:<[^>]*>)?\(\s*(\[[^\]]*\]|['"][^'"]+['"])/g;

/** A glob (`*`, `**`) as a regex over repo-relative paths. */
const globRe = (g) => new RegExp(`^${g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*\//g, '\u0000').replace(/\*/g, '[^/]*').replaceAll('\u0000', '(?:.*/)?')}$`);

/** Build the graph for the repo at `root` (default: the working directory). */
export function importGraph(root = process.cwd()) {
  const files = [];
  const walk = (d) => {
    if (!existsSync(d)) return;
    for (const e of readdirSync(d)) {
      if (SKIP.has(e)) continue;
      const p = join(d, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|svelte|js|mjs)$/.test(e)) files.push(relative(root, p));
    }
  };
  ROOTS.forEach((r) => walk(join(root, r)));
  const known = new Set(files);

  const deps = new Map(); // file -> files it imports
  for (const f of files) {
    const text = readFileSync(join(root, f), 'utf8');
    const out = new Set();
    const at = (spec) => relative(root, resolve(root, dirname(f), spec.replace(/\?.*$/, '')));
    for (const m of text.matchAll(IMPORT)) {
      if (m[2]) continue;
      const spec = m[3] ?? m[4];
      if (!spec?.startsWith('.')) continue;
      const base = at(spec);
      const hit = EXT.map((x) => base + x).find((c) => known.has(c));
      if (hit) out.add(hit);
    }
    for (const m of text.matchAll(GLOB)) {
      const pats = [...m[1].matchAll(/['"]([^'"]+)['"]/g)].map((x) => x[1]).filter((p) => p.startsWith('.'));
      for (const p of pats) {
        const re = globRe(at(p));
        for (const c of files) if (c !== f && re.test(c)) out.add(c);
      }
    }
    deps.set(f, out);
  }
  const importers = new Map(files.map((f) => [f, []]));
  for (const [f, ds] of deps) for (const d of ds) importers.get(d).push(f);

  /** Breadth-first over importers from `start`, at most `depth` hops: every reached file with the file it was reached from. */
  const reach = (start, depth = Infinity) => {
    const prev = new Map(start.map((s) => [s, null]));
    let frontier = [...start];
    for (let d = 0; d < depth && frontier.length; d++) {
      const next = [];
      for (const f of frontier) for (const i of importers.get(f) ?? []) if (!prev.has(i)) { prev.set(i, f); next.push(i); }
      frontier = next;
    }
    return prev;
  };
  const chain = (prev, f) => { const c = []; for (let x = f; x != null; x = prev.get(x)) c.push(x); return c; };
  return { files, known, deps, importers, reach, chain };
}

/** Test files by tier: fast (`*.test.ts` minus slow/soak) unless `all`. */
export const isTestFile = (f, all = false) => /\.test\.ts$/.test(f) && (all || !/\.(slow|soak)\.test\.ts$/.test(f));
