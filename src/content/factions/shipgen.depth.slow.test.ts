import { describe, expect, it } from 'vitest';
import { generateShip, type FactionDef, type GenResult, type ModuleDef } from '../../sim';
import { content } from '../index';
import { factions } from './index';

// Slow soak test (see "Test tiers" in docs/ARCHITECTURE.md): skipped by `npm run check:fast`, always run by `npm run check` and CI.
const defs = content.modules as Record<string, ModuleDef>;
const ids = Object.keys(factions) as (keyof typeof factions)[];
const gen = (id: keyof typeof factions, seed: number, depth: number): GenResult =>
  generateShip(factions[id] as FactionDef, id, seed, depth, defs);
const count = (g: GenResult, pred: (d: ModuleDef) => boolean): number =>
  (g.template.modules ?? []).filter((m) => defs[m.def] && pred(defs[m.def] as ModuleDef)).length;

describe('ship generator, depth scaling', () => {
  it('scales with depth: deeper ships are longer, better armed and shielded, with more power and crew', () => {
    for (const id of ids) {
      const stats = (g: GenResult) => [g.width, count(g, (d) => !!d.weapon), count(g, (d) => !!d.shieldGen), count(g, (d) => d.power > 0), g.template.crew?.length ?? 0];
      const avgs = (depth: number): number[] => {
        const s = [0, 0, 0, 0, 0];
        for (let seed = 0; seed < 30; seed++) stats(gen(id, seed, depth)).forEach((v, k) => { s[k]! += v / 30; });
        return s;
      };
      const [lo, hi] = [avgs(0), avgs(9)];
      for (let k = 0; k < 5; k++) {
        expect(hi[k], `${id} stat ${k}`).toBeGreaterThan(lo[k] as number);
      }
    }
  }, 120000);
});
