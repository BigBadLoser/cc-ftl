import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// @ts-expect-error a plain .mjs tool module without type declarations
import { importGraph } from './importGraph.mjs';

/**
 * Systems never import each other (CLAUDE.md hard rule): their order lives in src/sim/pipeline.ts, and only the pipeline
 * imports them. A system module is any file pipeline.ts imports a `...System` from. Helpers in the same folders that are
 * not systems may be shared freely. A system that needs another's result reads the sim state it left, or both call a shared
 * helper. ALLOWED lists existing violations as "importer -> imported" pairs; it may only shrink (it is empty today).
 */
const ALLOWED: string[] = [];

type Graph = { known: Set<string>; deps: Map<string, Set<string>> };
const g = importGraph() as Graph;
const pipeline = readFileSync('src/sim/pipeline.ts', 'utf8');
const systems = new Set<string>();
for (const m of pipeline.matchAll(/import \{([^}]*)\} from '(\.[^']+)'/g)) {
  if (/System\b/.test(m[1])) systems.add(`src/sim/${m[2].slice(2)}.ts`);
}
const pairs = [...systems].flatMap((f) => [...(g.deps.get(f) ?? [])].filter((d) => systems.has(d) && d !== f).map((d) => `${f} -> ${d}`)).sort();

describe('systems do not import each other', () => {
  it('finds the system modules in the pipeline', () => {
    expect(systems.size).toBeGreaterThan(80);
    expect([...systems].filter((f) => !g.known.has(f))).toEqual([]);
  });

  it('no system module imports another system module', () => {
    const fresh = pairs.filter((p) => !ALLOWED.includes(p));
    expect(fresh, 'a system imports another system: move what they share into a helper module both import, or have the second read the state the first writes; only src/sim/pipeline.ts orders systems').toEqual([]);
  });

  it('the allow-list is current (remove a pair once it is gone)', () => {
    expect(ALLOWED.filter((p) => !pairs.includes(p)), 'these pairs no longer exist: delete them from ALLOWED in tools/systemImports.test.ts').toEqual([]);
  });
});
