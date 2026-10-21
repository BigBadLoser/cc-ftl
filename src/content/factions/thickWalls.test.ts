import { describe, expect, it } from 'vitest';
import { generateShip, type FactionDef, type ModuleDef } from '../../sim';
import { content } from '../index';
import { factions } from './index';

const defs = content.modules as Record<string, ModuleDef>;
/** Welded scrapper seams keep a few wall tiles with no room beside them (between welded donors). */
const BOUND: Record<string, [number, number]> = { 'faction.scrapper': [0.06, 0.1] };

describe('wall thickness', () => {
  it('walls are one tile thick, and wall thinning never changes the outline (stair-stepped tapers stay)', () => {
    for (const [id, f] of Object.entries(factions)) {
      const v: number[] = [];
      for (const depth of [1, 4, 9]) {
        for (let seed = 1; seed <= 6; seed++) {
          const g = generateShip(f as FactionDef, id, seed, depth, defs);
          v.push(g.metrics?.thickWall ?? 1);
          // Every tile touching space (8 neighbours) is the same set before and after the pass.
          expect(g.thin?.outlineChanged, `${id} seed ${seed} depth ${depth}`).toBe(0);
        }
      }
      const [mean, max] = BOUND[id] ?? [0.02, 0.05];
      expect(v.reduce((a, b) => a + b, 0) / v.length, `${id} mean`).toBeLessThanOrEqual(mean);
      expect(Math.max(...v), `${id} max`).toBeLessThanOrEqual(max);
    }
  }, 240000);
});
