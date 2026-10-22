import { describe, expect, it } from 'vitest';
import { BIG, generateAsteroid } from './gen';
import type { OreDef } from './types';
import { validateAsteroid } from './validate';

const ORES: OreDef[] = [
  { code: 1, name: 'Iron', item: 'item.iron_ore', weight: 5, amount: [20, 60], color: 0 },
  { code: 2, name: 'Ice', item: 'item.ice', weight: 4, amount: [30, 80], color: 0 },
  { code: 3, name: 'Rare', item: 'item.rare_ore', weight: 1, amount: [5, 20], color: 0 },
];

describe('asteroid generation sweep', () => {
  it('every seed of 1..80 gives a sound big asteroid (each coverage class) and field', () => {
    const bad: string[] = [];
    for (let seed = 1; seed <= 80; seed++) {
      for (const [kind, coverage] of [['big', 'open'], ['big', 'mixed'], ['big', 'dense'], ['big', undefined], ['field', undefined]] as const) {
        const p = generateAsteroid(kind, seed, ORES, coverage === undefined ? {} : { coverage });
        const problems = validateAsteroid(p);
        if (kind === 'big') {
          const [lo, hi] = BIG.mass[p.coverage];
          if (p.mass < lo - 0.001 || p.mass > hi + 0.001) problems.push(`mass ${p.mass} outside ${lo}-${hi}`);
        }
        if (problems.length) bad.push(`${kind} ${coverage ?? ''} #${seed}: ${problems.join('; ')}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
