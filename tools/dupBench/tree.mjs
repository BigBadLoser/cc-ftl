// Cases, the temp source tree the detectors run on, and function line ranges (found by name with the TypeScript compiler API).
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = join(HERE, '..', '..');
const TEST_FILE = /\.(slow\.|soak\.)?test\.ts$/;

/** Every case under cases/: its id, case.json fields and planted source. */
export function loadCases() {
  const dir = join(HERE, 'cases');
  return readdirSync(dir)
    .sort()
    .map((id) => ({
      id,
      ...JSON.parse(readFileSync(join(dir, id, 'case.json'), 'utf8')),
      source: readFileSync(join(dir, id, 'planted.ts.txt'), 'utf8'),
    }));
}

/** Copy src (tests left out: no detector looks at them) into `root`/src, plus the configs a detector needs; add `cases` when given. */
export function buildTree(root, cases = []) {
  cpSync(join(REPO, 'src'), join(root, 'src'), { recursive: true, filter: (p) => !TEST_FILE.test(p) });
  for (const f of ['.jscpd.json', 'tsconfig.json']) if (existsSync(join(REPO, f))) cpSync(join(REPO, f), join(root, f));
  for (const c of cases) {
    const at = join(root, c.planted.target);
    if (existsSync(at)) throw new Error(`${c.id}: planted target ${c.planted.target} already exists in src`);
    mkdirSync(dirname(at), { recursive: true });
    writeFileSync(at, c.source);
  }
  return root;
}

/** 1-based inclusive line range of the function named `fn` (declaration, or const arrow/function expression) in a file. */
export function functionRange(file, fn) {
  const text = readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  let found = null;
  const line = (pos) => sf.getLineAndCharacterOfPosition(pos).line + 1;
  const visit = (n) => {
    if (found) return;
    const named =
      (ts.isFunctionDeclaration(n) && n.name?.text === fn && n.body) ||
      (ts.isVariableDeclaration(n) && n.name.getText() === fn && n.initializer && (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer)));
    if (named) {
      const node = ts.isVariableDeclaration(n) ? n.parent.parent : n; // include `export const`
      found = { start: line(node.getStart()), end: line(node.end) };
      return;
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  if (!found) throw new Error(`function ${fn} not found in ${file}`);
  return found;
}

/** Line span of a file's code: from its first top-level function or const to its last, so helpers a copy extracted count as the copy. */
export function codeRange(file) {
  const text = readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const code = sf.statements.filter((s) => ts.isFunctionDeclaration(s) || ts.isVariableStatement(s) || ts.isClassDeclaration(s));
  const line = (pos) => sf.getLineAndCharacterOfPosition(pos).line + 1;
  return { start: line(code[0].getStart()), end: line(code[code.length - 1].end) };
}

/** Ranges of the original function and the planted code (its whole code span, `fn` for the named function) of a case, inside the tree at `root`. */
export function caseRanges(root, c) {
  return {
    original: { file: c.original.file, ...functionRange(join(root, c.original.file), c.original.fn) },
    planted: { file: c.planted.target, ...codeRange(join(root, c.planted.target)), fn: functionRange(join(root, c.planted.target), c.planted.fn) },
  };
}

/** Range of the outermost function declaration or const arrow function that starts on `line`, or null. */
export function functionStartingAt(file, line) {
  const text = readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const lineOf = (pos) => sf.getLineAndCharacterOfPosition(pos).line + 1;
  let found = null;
  const visit = (n) => {
    if (found) return;
    const isFn = ts.isFunctionDeclaration(n) || ts.isArrowFunction(n) || ts.isFunctionExpression(n) || ts.isMethodDeclaration(n);
    if (isFn && lineOf(n.getStart()) === line) {
      found = { start: line, end: lineOf(n.end) };
      return;
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return found;
}

/**
 * A second tree for detectors that only compare inside one file (sonarjs): each planted file's code (imports dropped) is appended to
 * its original's file. Returns the tree's per-case ranges, the planted side being its code span in the combined file.
 */
export function buildCombinedTree(root, cases) {
  cpSync(join(REPO, 'src'), join(root, 'src'), { recursive: true, filter: (p) => !TEST_FILE.test(p) });
  const ranges = new Map();
  for (const c of cases) {
    const file = join(root, c.original.file);
    const body = c.source.split('\n').filter((l) => !l.startsWith('import ')).join('\n');
    const before = readFileSync(file, 'utf8').split('\n').length;
    writeFileSync(file, `${readFileSync(file, 'utf8')}\n${body}`);
    const original = { file: c.original.file, ...functionRange(file, c.original.fn) };
    const code = codeRange(file); // spans the whole file; the planted part starts after `before`
    const fn = functionRange(file, c.planted.fn);
    ranges.set(c.id, { original, planted: { file: c.original.file, start: Math.max(before + 1, fn.start), end: code.end, fn } });
  }
  return ranges;
}
