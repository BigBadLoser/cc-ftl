import { describe, expect, it } from 'vitest';
import { generateShip, type FactionDef, type GenResult, type ModuleDef } from '../../sim';
import { content } from '../index';
import { factions } from './index';

// Slow soak test (see "Test tiers" in docs/ARCHITECTURE.md): skipped by `npm run check:fast`, always run by `npm run check` and CI.
const defs = content.modules as Record<string, ModuleDef>;
const ids = Object.keys(factions) as (keyof typeof factions)[];
const gen = (id: keyof typeof factions, seed: number, depth: number): GenResult =>
  generateShip(factions[id] as FactionDef, id, seed, depth, defs);

describe('ship generator, many seeds', () => {
  for (const id of ids) {
    it(`${id}: 200 seeds across depths 0-9 all validate`, () => {
      const bad: string[] = [];
      for (let seed = 0; seed < 200; seed++) {
        const g = gen(id, seed * 7919 + 13, seed % 10);
        if (g.problems.length > 0) bad.push(`seed ${seed}: ${g.problems.join('; ')}`);
      }
      expect(bad).toEqual([]);
    }, 90000);
  }
});
