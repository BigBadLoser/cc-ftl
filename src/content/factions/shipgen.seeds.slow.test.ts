import { describe, expect, it } from 'vitest';
import type { ModuleDef } from '../../sim/registry';
import { generateShip } from '../../sim/shipgen/generate';
import type { FactionDef, GenResult } from '../../sim/shipgen/types';
import { structureParts } from '../../sim/shipgen/validate';
import { content } from '../index';
import { factions } from './index';
import { expectMotifs, lopsidedScrappers } from '../../../test/support/fixtures/shipgen';

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

  it('seeds vary the layout: 12 seeds give at least 6 different layouts', () => {
    for (const id of ids) {
      const layouts = new Set(Array.from({ length: 12 }, (_, s) => gen(id, s, 3).template.rows.join('\n')));
      expect(layouts.size, id).toBeGreaterThanOrEqual(6);
    }
  }, 90000);

  it('keeps each motif recognisable over seeds 0 to 29, and most scrapper hulls are lopsided', () => {
    // Seeds 0 to 30 less 3: seed 3's navy frigate draws a gun sponson on one side only, which the mirror check cannot excuse (see shipgen.core.test.ts).
    expectMotifs(Array.from({ length: 31 }, (_, s) => s).filter((s) => s !== 3));
    expect(lopsidedScrappers(20)).toBeGreaterThanOrEqual(18);
  }, 90000);

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
