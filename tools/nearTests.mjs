// Near tests for a tuning file, by name: a tuning file is a bag of constants that hundreds of files import, so selecting by file
// runs most of the fast tier for any edit (`tools/testFast.mjs`). Instead an edit to `tuning*.ts` follows only the importers that
// use a constant whose declaration changed. Anything this can't place (a changed private helper, a new file) falls back to the
// whole file.
import { basename } from 'node:path';

/** Tuning files: `tuning.ts`, `tuningGas.ts`, `galaxy/tuningWar.ts` and the like. */
export const isTuning = (f) => /(^|\/)tuning\w*\.ts$/.test(f);

const DECL = /^(export\s+)?(?:declare\s+)?(?:const|let|var|function|type|interface|enum|class)\s+(\w+)/;

/** The file's top-level declarations: name -> { text, exported }. `export const A = 1, B = 2;` declares both. Text before the first is under ''. */
export function declarations(text) {
  const out = new Map();
  let cur = { names: [''], exported: false, lines: [] };
  const close = () => { for (const n of cur.names) out.set(n, { text: cur.lines.join('\n').trimEnd(), exported: cur.exported }); };
  for (const line of text.split('\n')) {
    const m = DECL.exec(line);
    if (m) {
      close();
      const more = /^(?:export\s+)?(?:const|let|var)\s/.test(line) ? [...line.matchAll(/,\s*(\w+)\s*=/g)].map((x) => x[1]) : [];
      cur = { names: [m[2], ...more], exported: Boolean(m[1]), lines: [] };
    }
    cur.lines.push(line);
  }
  close();
  return out;
}

/**
 * The exported names whose declaration differs between `before` and `after` (added and removed ones too), or null when the
 * change can't be pinned to exports: a new or deleted file, or a changed non-exported declaration that exports may use.
 * Comments sit with the declaration above them, so an edited comment may name a neighbour: harmless, it only adds tests.
 */
export function changedExports(before, after) {
  if (before == null || after == null) return null;
  const a = declarations(before), b = declarations(after);
  const names = new Set();
  for (const n of new Set([...a.keys(), ...b.keys()])) {
    const x = a.get(n), y = b.get(n);
    if (x?.text === y?.text) continue;
    if (n === '') { if (strip(x?.text) !== strip(y?.text)) return null; continue; } // imports or header code changed
    if ((x && !x.exported) || (y && !y.exported)) return null; // a private helper: exports may use it
    names.add(n);
  }
  return names;
}
const strip = (t = '') => t.split('\n').filter((l) => !/^\s*(\/\/|\/?\*|$)/.test(l)).join('\n');

/**
 * The files that use one of `names` from `file`: its importers whose text names one, and through a barrel that re-exports it
 * (`export * from './tuning'`), the barrel's importers that do.
 */
export function usersOf(graph, file, names, read) {
  const words = [...names].map((n) => new RegExp(`\\b${n}\\b`));
  const uses = (t) => words.some((w) => w.test(t));
  const out = new Set();
  const seen = new Set([file]);
  const visit = (f) => {
    const barrelOf = new RegExp(`export\\s*\\*\\s*from\\s*['"][^'"]*\\b${basename(f, '.ts')}(\\.ts|\\.js)?['"]`);
    for (const i of graph.importers.get(f) ?? []) {
      if (seen.has(i)) continue;
      seen.add(i);
      const t = read(i);
      if (barrelOf.test(t)) visit(i);
      if (uses(t)) out.add(i);
    }
  };
  visit(file);
  return out;
}

/**
 * Near tests (test files within `depth` imports) of `changed`, a tuning file counting only from the users of its changed
 * constants. `before(f)` is a file's text at the base (null when new), `read(f)` its current text (null when deleted).
 * Returns the selected files and, per tuning file, the names followed (null: the whole file).
 */
export function nearFiles(graph, changed, depth, before, read) {
  const plain = [], scoped = [], followed = new Map();
  for (const f of changed) {
    if (!graph.known.has(f)) continue; // deleted, or not source
    const names = isTuning(f) ? changedExports(before(f), read(f)) : null;
    if (names == null) { plain.push(f); if (isTuning(f)) followed.set(f, null); continue; }
    followed.set(f, [...names]);
    scoped.push(...usersOf(graph, f, names, read));
  }
  const all = new Set([...graph.reach(plain, depth).keys()]);
  if (depth > 0) for (const f of graph.reach(scoped, depth - 1).keys()) all.add(f);
  return { files: all, followed };
}

