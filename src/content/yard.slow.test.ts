import { describe, expect, it } from 'vitest';
import { Struct, YardCrewC, builtCount, deserialize, hullLoad, isLiveOrder, plannedTiles, quoteYard, serialize, shipGrid, totalTiles, yardPrice, yardService } from '../sim';
import { content } from './index';
import { giveItems } from '../sim/story/effects';
import { outline, planHull, run, yardGame } from './yardFixture';

// Slow tier (see "Test tiers" in docs/ARCHITECTURE.md): bigger yard jobs, run to the end. Skipped by `npm run check:fast`.
describe('shipyard: bigger jobs', () => {
  it('a hub yard builds two separate patches, one on each side, and nobody is walled in', () => {
    const { sim, station, me } = yardGame('hub', 'station.military');
    giveItems(sim, 'item.metal', 300);
    planHull(sim, me, [...outline(sim, me, 8, -2, 6, 3), ...outline(sim, me, 5, 19, 5, 3), ...outline(sim, me, 24, -2, 4, 3)]);
    sim.enqueue({ type: 'yard.order', station });
    expect(run(sim, 1)).toContain('yard.ordered');
    const order = sim.yard.orders[0]!;
    expect(order.gaps).toHaveLength(3);
    const hull = hullLoad(sim, me).tiles;
    run(sim, 12000, () => !isLiveOrder(order));
    expect(order.phase).toBe('done');
    expect(order.reason).toBeUndefined();
    expect(builtCount(sim, order).floor).toBe(order.floor.length);
    expect(builtCount(sim, order).truss).toBe(order.trusses.length);
    expect(builtCount(sim, order).walls).toBe(order.walls.length);
    expect(hullLoad(sim, me).tiles).toBeGreaterThan(hull);
    const grid = shipGrid(sim, me)!;
    for (const g of order.gaps) expect(grid.get('struct', g.wall.x, g.wall.y)).toBe(Struct.Wall);
    expect(sim.world.query(YardCrewC)).toHaveLength(0);
    expect(totalTiles(order)).toBe(order.trusses.length + order.floor.length + order.walls.length);
    expect(order.walls).toHaveLength(36);
  }, 300000);

  it('trusses the whole plan outside the cap, turns up to the cap into hull, and leaves the rest as trusses that persist and are converted at the next yard without a second fee', () => {
    // A small yard (12 tiles a visit (a smaller cap cannot build a part 3 wide)) and a small plan keep the run short.
    const small = { ...content, yard: { ...content.yard, sizes: { ...content.yard.sizes, station: { cap: 12, price: 1 } } } };
    const { sim, station, me } = yardGame('station', 'station.trading', small);
    giveItems(sim, 'item.metal', 200);
    planHull(sim, me, outline(sim, me, 8, -2, 6, 3)); // 14 tiles of outline round 4 floor: more than one visit builds
    const q1 = quoteYard(sim, station, me);
    expect(q1.trusses.length).toBeGreaterThan(12); // the planning pass is not held to the cap
    expect(q1.walls.length + q1.floor.length).toBeLessThanOrEqual(12);
    expect(q1.fee.credits).toBe(2 * q1.trusses.length);
    const credits = sim.trade.credits;
    sim.enqueue({ type: 'yard.order', station });
    expect(run(sim, 1)).toContain('yard.ordered');
    const o1 = sim.yard.orders[0]!;
    expect(sim.trade.credits).toBe(credits - q1.price.credits);
    run(sim, 6000, () => o1.stage === 'hull');
    expect(o1.stage).toBe('hull');
    // Every reachable planned tile has its truss (the patch's gap wall stays open for the crew), and it is the ship's.
    const grid = shipGrid(sim, me)!;
    for (const t of o1.trusses) {
      expect(grid.get('struct', t.x, t.y), `truss ${t.x},${t.y}`).toBe(Struct.Beam);
      expect(grid.get('ship', t.x, t.y)).toBe(me);
    }
    run(sim, 6000, () => !isLiveOrder(o1));
    expect(o1.phase).toBe('done');
    const b1 = builtCount(sim, o1);
    expect(b1.floor + b1.walls).toBeLessThanOrEqual(12);
    expect(b1.truss).toBe(o1.trusses.length);
    // What is left of the plan is still trussed (open scaffolding).
    const left = plannedTiles(sim, me);
    expect(left.length).toBeGreaterThan(0);
    for (const t of left) expect(grid.get('struct', t.x, t.y)).toBe(Struct.Beam);
    // It persists through a save and a load.
    const back = deserialize(serialize(sim), small);
    expect(plannedTiles(back, me)).toEqual(left);
    // The next visit picks it up: no planning fee for tiles that already have a truss, and the hull goes on from them.
    const q2 = quoteYard(back, station, me);
    expect(q2.error).toBeNull();
    expect(q2.trusses).toHaveLength(0);
    expect(q2.fee.credits).toBe(0);
    expect(q2.walls.length).toBeGreaterThan(0);
    back.enqueue({ type: 'yard.order', station });
    expect(run(back, 1)).toContain('yard.ordered');
    const o2 = back.yard.orders.at(-1)!;
    expect(o2.stage).toBe('hull'); // no planning pass this time
    expect(o2.price.credits).toBe(yardPrice(back, yardService(back, station)!, o2.walls.length + o2.floor.length).credits);
  }, 120000);
});
