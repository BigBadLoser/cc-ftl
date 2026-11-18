import { describe, expect, it } from 'vitest';
// @ts-expect-error a plain .mjs tool module without type declarations
import * as near from './nearTests.mjs';

type Graph = { known: Set<string>; importers: Map<string, string[]>; reach: (s: string[], d: number) => Map<string, string | null> };
const { changedExports, nearFiles } = near as {
  changedExports: (a: string | null, b: string | null) => Set<string> | null;
  nearFiles: (g: Graph, changed: string[], depth: number, before: (f: string) => string | null, read: (f: string) => string | null) => { files: Set<string>; followed: Map<string, string[] | null> };
};

/** A graph from `file -> its importers`, reach as in tools/importGraph.mjs. */
function graph(importers: Record<string, string[]>): Graph {
  const map = new Map(Object.entries(importers));
  const known = new Set([...map.keys(), ...[...map.values()].flat()]);
  const reach = (start: string[], depth: number) => {
    const prev = new Map<string, string | null>(start.map((s) => [s, null]));
    let frontier = [...start];
    for (let d = 0; d < depth && frontier.length; d++) {
      const next: string[] = [];
      for (const f of frontier) for (const i of map.get(f) ?? []) if (!prev.has(i)) { prev.set(i, f); next.push(i); }
      frontier = next;
    }
    return prev;
  };
  return { known, importers: map, reach };
}

const BEFORE = `import { x } from './x';
/** Gap. */
export const GAP = 4;
export const A = 1, B = 2;
const helper = 3;
export const C = helper * 2;
`;

describe('changedExports', () => {
  it('names the exports whose declaration changed, comments with them', () => {
    expect(changedExports(BEFORE, BEFORE.replace('GAP = 4', 'GAP = 5'))).toEqual(new Set(['GAP']));
    expect(changedExports(BEFORE, BEFORE.replace('A = 1, B = 2', 'A = 1, B = 3'))).toEqual(new Set(['A', 'B']));
    expect(changedExports(BEFORE, `${BEFORE}export const D = 1;\n`)).toEqual(new Set(['D']));
    expect(changedExports(BEFORE, BEFORE)).toEqual(new Set());
  });
  it('gives up (null) on a changed private helper, changed imports or a new file', () => {
    expect(changedExports(BEFORE, BEFORE.replace('helper = 3', 'helper = 4'))).toBeNull();
    expect(changedExports(BEFORE, BEFORE.replace("'./x'", "'./y'"))).toBeNull();
    expect(changedExports(null, BEFORE)).toBeNull();
  });
});

describe('nearFiles', () => {
  const g = graph({
    'tuning.ts': ['index.ts', 'a.ts', 'b.ts'],
    'index.ts': ['c.ts'],
    'a.ts': ['a.test.ts', 'hub.ts'],
    'b.ts': ['b.test.ts'],
    'c.ts': ['c.test.ts'],
    'hub.ts': ['hub.test.ts'],
  });
  const text: Record<string, string> = {
    'tuning.ts': BEFORE.replace('GAP = 4', 'GAP = 5'),
    'index.ts': "export * from './tuning';",
    'a.ts': 'use(GAP)',
    'b.ts': 'use(A)',
    'c.ts': 'use(GAP)',
  };
  const read = (f: string) => text[f] ?? '';
  it('follows only the users of the changed constant, through a barrel too', () => {
    const { files, followed } = nearFiles(g, ['tuning.ts'], 2, () => BEFORE, read);
    expect(followed.get('tuning.ts')).toEqual(['GAP']);
    expect([...files].filter((f) => f.endsWith('.test.ts')).sort()).toEqual(['a.test.ts', 'c.test.ts']); // not b's, not hub's (3 imports)
  });
  it('falls back to the whole file when the change is not pinned to exports', () => {
    const { files, followed } = nearFiles(g, ['tuning.ts'], 2, () => null, read);
    expect(followed.get('tuning.ts')).toBeNull();
    expect([...files].filter((f) => f.endsWith('.test.ts')).sort()).toEqual(['a.test.ts', 'b.test.ts']); // c is 3 imports away
  });
});
