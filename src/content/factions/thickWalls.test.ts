import { describe, expect, it } from 'vitest';
import type { ModuleDef } from '../../sim/registry';
import { generateShip } from '../../sim/shipgen/generate';
import type { FactionDef } from '../../sim/shipgen/types';
import { content } from '../index';
import { factions } from './index';

const defs = content.modules as Record<string, ModuleDef>;
/** Welded scrapper seams keep a few wall tiles with no room beside them (between welded donors); the pirate factions fly the same hulls. */
const SCRAP: [number, number] = [0.06, 0.1];
const BOUND: Record<string, [number, number]> = {
  'faction.scrapper': SCRAP, 'faction.raider': SCRAP, 'faction.cartel': SCRAP, 'faction.zealot': SCRAP, 'faction.mercenary': SCRAP,
};

/** Two wall tiles side by side between two floor tiles, along a row or a column: a double wall between rooms ("x,y" of the first wall). */
function doubleWalls(rows: readonly string[]): string[] {
  const at = (x: number, y: number): string => rows[y]?.[x] ?? '.';
  const out: string[] = [];
  rows.forEach((r, y) => [...r].forEach((c, x) => {
    if (c !== '_') return;
    for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
      if (at(x + dx, y + dy) === '#' && at(x + 2 * dx, y + 2 * dy) === '#' && at(x + 3 * dx, y + 3 * dy) === '_') out.push(`${x + dx},${y + dy}`);
    }
  }));
  return out;
}

describe('wall thickness', () => {
  it('walls are one tile thick, and wall thinning never changes the outline (stair-stepped tapers stay)', () => {
    for (const [id, f] of Object.entries(factions)) {
      const v: number[] = [];
      for (const depth of [1, 4, 9]) {
        for (let seed = 1; seed <= 6; seed++) {
          const g = generateShip(f as FactionDef, id, seed, depth, defs);
          v.push(g.metrics?.thickWall ?? 1);
          // Every tile touching space (8 neighbours) is the same set before and after the pass. (An outline hull is drawn
          // with one-tile walls and never thinned.)
          if (!(f as FactionDef).outline) expect(g.thin?.outlineChanged, `${id} seed ${seed} depth ${depth}`).toBe(0);
        }
      }
      const [mean, max] = BOUND[id] ?? [0.02, 0.05];
      expect(v.reduce((a, b) => a + b, 0) / v.length, `${id} mean`).toBeLessThanOrEqual(mean);
      expect(Math.max(...v), `${id} max`).toBeLessThanOrEqual(max);
    }
  }, 240000);

  it('outline hulls (the navy) have no double wall between rooms: at most a corner tile or two on a few ships', () => {
    const outline = Object.entries(factions).filter(([, f]) => (f as FactionDef).outline);
    expect(outline.length).toBeGreaterThan(0);
    for (const [id, f] of outline) {
      let ships = 0, doubled = 0;
      for (const depth of [1, 4, 9]) {
        for (let seed = 1; seed <= 12; seed++) {
          const g = generateShip(f as FactionDef, id, seed, depth, defs);
          const d = doubleWalls(g.template.rows);
          // (Where an outer room starts a column off the inner room beside it, a notch: never a wall slab along a room.)
          expect(d.length, `${id} seed ${seed} depth ${depth} (${g.role}): ${d.join(' ')}`).toBeLessThanOrEqual(2);
          ships++;
          if (d.length > 0) doubled++;
        }
      }
      expect(doubled, `${id}: ships with a double wall`).toBeLessThanOrEqual(ships / 12);
    }
  }, 120000);
});
