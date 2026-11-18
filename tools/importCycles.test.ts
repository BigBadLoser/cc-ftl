import { describe, expect, it } from 'vitest';
// @ts-expect-error a plain .mjs tool module without type declarations
import { importGraph } from './importGraph.mjs';

/**
 * Import-cycle ratchet. The sim has one large import cycle through its feature modules (combat/ships, vehicles, trade,
 * story, galaxy, away...), which ties most features to each other and makes a sim edit reach most of the tests. The numbers
 * below are the current state: they may only go down. A change that adds a cycle or grows one fails here; a change that
 * breaks one fails too, so the numbers come down with it (lower them in the same change). `npm run test:why` and
 * tools/importGraph.mjs `cycles()` show the groups.
 */
const BASELINE = { largest: 142, inCycles: 147, groups: 3 };

type Graph = { cycles: (keep?: (f: string) => boolean) => string[][] };

describe('import cycles in src', () => {
  const groups = (importGraph() as Graph).cycles((f) => f.startsWith('src/') && !/\.test\.ts$/.test(f));
  const now = { largest: groups[0]?.length ?? 0, inCycles: groups.reduce((n, g) => n + g.length, 0), groups: groups.length };
  const show = groups.map((g) => `${g.length}: ${g.slice(0, 8).join(', ')}${g.length > 8 ? ', ...' : ''}`).join('\n');

  it('no new or larger import cycles', () => {
    expect(now.largest, `the largest cycle grew:\n${show}`).toBeLessThanOrEqual(BASELINE.largest);
    expect(now.inCycles, `more files are in cycles:\n${show}`).toBeLessThanOrEqual(BASELINE.inCycles);
    expect(now.groups, `a new cycle appeared:\n${show}`).toBeLessThanOrEqual(BASELINE.groups);
  });

  it('the baseline is current (lower it when a cycle is broken)', () => {
    expect(now, 'cycles shrank: lower BASELINE in tools/importCycles.test.ts to these numbers').toEqual(BASELINE);
  });
});
