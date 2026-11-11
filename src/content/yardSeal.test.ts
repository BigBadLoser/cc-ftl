import { describe, expect, it } from 'vitest';
import { brushPlan, type Sim } from '../sim';
import { Struct } from '../sim/structure';
import { sealProblem } from '../sim/shipgen/validate';
import { outlineOf } from '../sim/yard/width';
import { rect, yardGame } from './yardFixture';

/** The hull starts one row below the ship's rectangle, so a block ending at row 0 touches it. */
const top = (h: number): number => 1 - h;
type Tile = { x: number; y: number };

/** Floor tiles of the footprint (not outline) that have open space among their 8 neighbours: must be none. */
function leaks(sim: Sim, footprint: Tile[]): Tile[] {
  const g = sim.sector.grid;
  const inside = new Set(footprint.map((t) => `${t.x},${t.y}`));
  const open = (x: number, y: number): boolean => !inside.has(`${x},${y}`) && (g.get('struct', x, y) === Struct.Space || g.get('struct', x, y) === Struct.Beam);
  const outline = new Set(outlineOf(sim, footprint).map((t) => `${t.x},${t.y}`));
  const bad: Tile[] = [];
  for (const t of footprint) {
    // every tile touching open space must be in the outline (the wall); none may be missed at a corner
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if ((dx || dy) && open(t.x + dx, t.y + dy) && !outline.has(`${t.x},${t.y}`)) bad.push(t);
    }
  }
  return bad;
}

describe('hull plan: the outline seals corners', () => {
  it('a convex corner: the outline holds every tile touching space, diagonals included', () => {
    const { sim, me } = yardGame();
    const r = brushPlan(sim, me, 'add', rect(sim, me, 2, top(6), 6, 6));
    expect(r.error).toBe(null);
    expect(leaks(sim, r.footprint)).toEqual([]);
    expect(r.outline.length).toBeGreaterThan(0);
  });

  it('an L-shaped plan seals its inner (concave) corner', () => {
    const { sim, me } = yardGame();
    const a = brushPlan(sim, me, 'add', rect(sim, me, 2, top(8), 4, 8));
    expect(a.error).toBe(null);
    sim.enqueue({ type: 'hull.plan', ship: me, tiles: a.outline });
    sim.step();
    const b = brushPlan(sim, me, 'add', rect(sim, me, 6, top(4), 5, 4));
    expect(b.error).toBe(null);
    expect(leaks(sim, b.footprint)).toEqual([]);
    // the tile diagonal to the concave corner is wall, not floor
    const corner = b.outline.some((t) => leaks(sim, [t]).length === 0);
    expect(corner).toBe(true);
  });

  it('a notch cut into a block seals', () => {
    const { sim, me } = yardGame();
    const a = brushPlan(sim, me, 'add', rect(sim, me, 2, top(9), 9, 9));
    expect(a.error).toBe(null);
    sim.enqueue({ type: 'hull.plan', ship: me, tiles: a.outline });
    sim.step();
    const n = brushPlan(sim, me, 'erase', rect(sim, me, 5, top(9), 3, 3));
    expect(n.error).toBe(null);
    expect(n.unchanged).toBe(false);
    expect(leaks(sim, n.footprint)).toEqual([]);
  });
});

describe('validateTemplate: the seal rule', () => {
  it('names the floor tile that touches space through a corner', () => {
    const rows = ['.###', '#__#', '####'];
    const cells = rows.flatMap((r) => [...r]);
    expect(sealProblem(cells, 4, 3)).toBe('seal: 1 floor tiles touch space, first at 1,1 (space at 0,0)');
    expect(sealProblem(['###', '#_#', '###'].flatMap((r) => [...r]), 3, 3)).toBe(null);
  });
});
