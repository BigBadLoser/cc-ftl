import { describe, expect, it } from 'vitest';
import type { ModuleDef } from '../../sim/registry';
import { equipmentShort } from '../../sim/shipgen/equipment';
import { generateShip, previewHull } from '../../sim/shipgen/generate';
import type { FactionDef } from '../../sim/shipgen/types';
import { content } from '../index';
import { factions } from './index';

// Slow sweep (see "Test tiers" in docs/ARCHITECTURE.md); the fast guard is shipgen.equipment.test.ts.
const defs = content.modules as Record<string, ModuleDef>;
const DEPTHS = [0, 1, 4, 6, 9];
const SEEDS = 8;
const ids = Object.keys(factions) as (keyof typeof factions)[];

describe('ship generator: planned equipment and family, many seeds (#577)', () => {
  for (const id of ids) {
    it(`${id}: ${SEEDS} seeds at depths ${DEPTHS.join(', ')} carry their plan's equipment and build the family their seed previews`, () => {
      const bad: string[] = [];
      const f = factions[id] as FactionDef;
      for (const depth of DEPTHS) {
        for (let k = 0; k < SEEDS; k++) {
          const seed = (k * 2654435761 + depth * 97 + 13) >>> 1;
          const g = generateShip(f, id, seed, depth, defs);
          const short = g.planned ? equipmentShort(defs, g.planned, g.template) : 'no plan';
          const fam = previewHull(f, seed, depth);
          if (short || g.role !== fam || g.problems.length > 0) bad.push(`depth ${depth} seed ${seed} ${g.role}/${fam}: ${short ?? ''} ${g.problems.join('; ')}`);
        }
      }
      expect(bad).toEqual([]);
    }, 120000);
  }
});
