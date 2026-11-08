import { describe, expect, it } from 'vitest';
import { generateShip, structureParts, type FactionDef, type GenResult, type ModuleDef } from '../../sim';
import { content } from '../index';
import { factions } from './index';

// Slow soak test (see "Test tiers" in docs/ARCHITECTURE.md): skipped by `npm run check:fast`, always run by `npm run check` and CI.
const defs = content.modules as Record<string, ModuleDef>;
const SEEDS = 40;
const ids = Object.keys(factions) as (keyof typeof factions)[];
const gen = (id: keyof typeof factions, seed: number, depth: number): GenResult =>
  generateShip(factions[id] as FactionDef, id, seed, depth, defs);

describe('ship generator, many seeds', () => {
  for (const id of ids) {
    // 40 seeds: four at each depth 0-9, for every faction. The generator is deterministic, so a broken template shows within a few seeds; more only re-rolls the same templates.
    it(`${id}: ${SEEDS} seeds across depths 0-9 all validate`, () => {
      const bad: string[] = [];
      for (let seed = 0; seed < SEEDS; seed++) {
        const g = gen(id, seed * 7919 + 13, seed % 10);
        if (g.problems.length > 0) bad.push(`seed ${seed}: ${g.problems.join('; ')}`);
      }
      expect(bad).toEqual([]);
    }, 90000);
  }

  it('every ship is one connected structure (hull, walls, floors, beams 4-connected), first attempt mostly (seeds 1 to 12 at depths 1, 4 and 9)', () => {
    for (const id of ids) {
      let reseeded = 0;
      for (const depth of [1, 4, 9]) {
        for (let seed = 1; seed <= 12; seed++) {
          const g = gen(id, seed, depth);
          const w = Math.max(...g.template.rows.map((r) => r.length));
          const cells = g.template.rows.flatMap((r) => Array.from({ length: w }, (_, x) => r[x] ?? '.'));
          expect(structureParts(cells, w, g.template.rows.length), `${id} seed ${seed} depth ${depth}`).toBe(1);
          if (g.failures.some((f) => f.includes('disconnected'))) reseeded++;
        }
      }
      // Gaps are fixed at the source, not by reseeding.
      expect(reseeded, `${id} reseeds for disconnection`).toBeLessThanOrEqual(1);
    }
  }, 240000);
});
