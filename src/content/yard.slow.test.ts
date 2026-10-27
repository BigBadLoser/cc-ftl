import { describe, expect, it } from 'vitest';
import { Struct, YardCrewC, builtCount, hullLoad, isLiveOrder, shipGrid, totalTiles } from '../sim';
import { giveItems } from '../sim/story/effects';
import { outline, planHull, run, yardGame } from './yardFixture';

// Slow tier (see "Test tiers" in docs/ARCHITECTURE.md): bigger yard jobs, run to the end. Skipped by `npm run check:fast`.
describe('shipyard: bigger jobs', () => {
  it('a hub yard builds two separate patches, one on each side, and nobody is walled in', () => {
    const { sim, station, me } = yardGame('hub', 'station.military');
    giveItems(sim, 'item.metal', 300);
    planHull(sim, me, [...outline(sim, me, 8, -2, 6, 3), ...outline(sim, me, 5, 19, 5, 3), ...outline(sim, me, 24, -3, 4, 3)]);
    sim.enqueue({ type: 'yard.order', station });
    expect(run(sim, 1)).toContain('yard.ordered');
    const order = sim.yard.orders[0]!;
    expect(order.gaps).toHaveLength(3);
    const hull = hullLoad(sim, me).tiles;
    run(sim, 12000, () => !isLiveOrder(order));
    expect(order.phase).toBe('done');
    expect(order.reason).toBeUndefined();
    expect(builtCount(sim, order).floor).toBe(order.floor.length);
    expect(builtCount(sim, order).walls).toBe(order.walls.length);
    expect(hullLoad(sim, me).tiles).toBeGreaterThan(hull);
    const grid = shipGrid(sim, me)!;
    for (const g of order.gaps) expect(grid.get('struct', g.wall.x, g.wall.y)).toBe(Struct.Wall);
    expect(sim.world.query(YardCrewC)).toHaveLength(0);
    expect(totalTiles(order)).toBe(order.floor.length + order.walls.length);
    expect(order.walls).toHaveLength(36);
  }, 300000);
});
