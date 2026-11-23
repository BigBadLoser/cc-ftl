import { describe, expect, it } from 'vitest';
import type { ModuleDef } from '../../sim/registry';
import { generateShip } from '../../sim/shipgen/generate';
import type { FactionDef, GenResult } from '../../sim/shipgen/types';
import { content } from '../index';
import { factions } from './index';

// Slow soak test (see "Test tiers" in docs/ARCHITECTURE.md): skipped by `npm run check:fast`, always run by `npm run check` and CI.
const defs = content.modules as Record<string, ModuleDef>;
const SEEDS = 12; // per depth and faction: the averages separate by a wide margin, so a dozen is enough to see the trend
const ids = Object.keys(factions) as (keyof typeof factions)[];
const gen = (id: keyof typeof factions, seed: number, depth: number): GenResult =>
  generateShip(factions[id] as FactionDef, id, seed, depth, defs);
const count = (g: GenResult, pred: (d: ModuleDef) => boolean): number =>
  (g.template.modules ?? []).filter((m) => defs[m.def] && pred(defs[m.def] as ModuleDef)).length;

/** Total reactor output: deeper ships use bigger reactors (tiers), not always more of them. */
const power = (g: GenResult): number => (g.template.modules ?? []).reduce((n, m) => n + Math.max(0, defs[m.def]?.power ?? 0), 0);

describe('ship generator, depth scaling', () => {
  it('scales with depth: deeper ships are longer, better armed and shielded, with more power and crew', () => {
    for (const id of ids) {
      const stats = (g: GenResult) => [g.width, count(g, (d) => !!d.weapon), count(g, (d) => !!d.shieldGen), power(g), g.template.crew?.length ?? 0];
      const avgs = (depth: number): number[] => {
        const s = [0, 0, 0, 0, 0];
        for (let seed = 0; seed < SEEDS; seed++) stats(gen(id, seed, depth)).forEach((v, k) => { s[k]! += v / SEEDS; });
        return s;
      };
      const [lo, hi] = [avgs(0), avgs(9)];
      for (let k = 0; k < 5; k++) {
        expect(hi[k], `${id} stat ${k}`).toBeGreaterThan(lo[k] as number);
      }
    }
  }, 120000);
});
