import { describe, expect, it } from 'vitest';
import { Struct, YardCrewC, builtCount, hullLoad, isLiveOrder, shipGrid, totalTiles } from '../sim';
import { giveItems } from '../sim/story/effects';
import { rect, run, yardGame } from './yardFixture';

// Slow tier (see "Test tiers" in docs/ARCHITECTURE.md): bigger yard jobs, run to the end. Skipped by `npm run check:fast`.
describe('shipyard: bigger jobs', () => {
  it('a hub yard builds two separate patches, one on each side, and nobody is walled in', () => {
    const { sim, station, me } = yardGame('hub', 'station.military');
    giveItems(sim, 'item.metal', 300);
    const tiles = [...rect(sim, me, 8, -2, 6, 3), ...rect(sim, me, 5, 19, 5, 1), ...rect(sim, me, 24, -1, 2, 2)];
    sim.enqueue({ type: 'yard.order', station, tiles });
    expect(run(sim, 1)).toContain('yard.ordered');
    const order = sim.yard.orders[0]!;
    expect(order.gaps).toHaveLength(3);
    const hull = hullLoad(sim, me).tiles;
    run(sim, 12000, () => !isLiveOrder(order));
    expect(order.phase).toBe('done');
    expect(order.reason).toBeUndefined();
    expect(builtCount(sim, order).floor).toBe(tiles.length);
    expect(builtCount(sim, order).walls).toBe(order.walls.length);
    expect(hullLoad(sim, me).tiles).toBe(hull + order.walls.length);
    const grid = shipGrid(sim, me)!;
    for (const g of order.gaps) expect(grid.get('struct', g.wall.x, g.wall.y)).toBe(Struct.Wall);
    expect(sim.world.query(YardCrewC)).toHaveLength(0);
    expect(totalTiles(order)).toBe(tiles.length + order.walls.length);
  }, 300000);
});
