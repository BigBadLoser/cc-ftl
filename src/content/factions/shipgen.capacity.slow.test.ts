import { describe, expect, it } from 'vitest';
import { templateHullLoad } from '../../sim/ftl/capacity';
import type { ModuleDef } from '../../sim/registry';
import { generateShip } from '../../sim/shipgen/generate';
import type { FactionDef } from '../../sim/shipgen/types';
import { content } from '../index';
import { factions } from './index';

// Slow sweep (see "Test tiers" in docs/ARCHITECTURE.md). The fast guard is the spawn test (`shipgen.spawn.test.ts`), which checks
// `hullLoad` on twelve spawned ships of each faction.
const defs = content.modules as Record<string, ModuleDef>;
const SEEDS = 8;
const DEPTHS = [1, 4, 9];
// Every faction that flies (navy, drones, scrappers, civilians, pirates). Stations are built by `buildStation` and never jump.
const ids = Object.keys(factions) as (keyof typeof factions)[];

describe('ship generator: engines carry the hull (#129)', () => {
  for (const id of ids) {
    it(`${id}: every ship over ${SEEDS} seeds at depths ${DEPTHS.join(', ')} fits within its own engines' capacity`, () => {
      const over: string[] = [];
      for (const depth of DEPTHS) {
        for (let seed = 0; seed < SEEDS; seed++) {
          const g = generateShip(factions[id] as FactionDef, id, seed * 104729 + 17, depth, defs);
          const load = templateHullLoad(defs, g.template);
          expect(load.engines, `depth ${depth} seed ${seed}: engines`).toBeGreaterThan(0);
          if (load.over > 0) over.push(`depth ${depth} seed ${seed} ${g.role}: ${load.tiles} tiles on ${load.engines} engines (${load.capacity})`);
        }
      }
      expect(over).toEqual([]);
    }, 120000);
  }
});
