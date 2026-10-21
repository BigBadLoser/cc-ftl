import { describe, expect, it } from 'vitest';
import { generateAsteroid } from './gen';
import type { OreDef } from './types';
import { validateAsteroid } from './validate';

const ORES: OreDef[] = [
  { code: 1, name: 'Iron', item: 'item.metal', weight: { big: 6, field: 5 }, amount: [20, 60], color: 0 },
  { code: 2, name: 'Ice', item: 'item.ice', weight: { big: 3, field: 4 }, amount: [30, 80], color: 0 },
  { code: 3, name: 'Rare', item: 'item.electronics', weight: { big: 1, field: 1 }, amount: [5, 20], color: 0 },
];

describe('asteroid generation sweep', () => {
  it('every seed of 1..80 gives a sound big asteroid (both variants) and field', () => {
    const bad: string[] = [];
    for (let seed = 1; seed <= 80; seed++) {
      for (const [kind, hollow] of [['big', true], ['big', false], ['field', undefined]] as const) {
        const p = generateAsteroid(kind, seed, ORES, hollow === undefined ? {} : { hollow });
        const problems = validateAsteroid(p);
        if (kind === 'big' && hollow && !p.core) problems.push('no core');
        if (problems.length) bad.push(`${kind}${hollow ? ' hollow' : ''} #${seed}: ${problems.join('; ')}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
