import { describe, expect, it } from 'vitest';
import { generateShip, type FactionDef, type ModuleDef } from '../../sim';
import { content } from '../index';
import { factions } from './index';

const defs = content.modules as Record<string, ModuleDef>;

describe('wall thickness', () => {
  it('walls are one tile thick: few wall tiles with no floor, door or module beside them, in every faction', () => {
    for (const [id, f] of Object.entries(factions)) {
      const v: number[] = [];
      for (const depth of [1, 4, 9]) for (let seed = 1; seed <= 6; seed++) v.push(generateShip(f as FactionDef, id, seed, depth, defs).metrics?.thickWall ?? 1);
      expect(v.reduce((a, b) => a + b, 0) / v.length, `${id} mean`).toBeLessThanOrEqual(0.02);
      expect(Math.max(...v), `${id} max`).toBeLessThanOrEqual(0.05);
    }
  }, 240000);
});
