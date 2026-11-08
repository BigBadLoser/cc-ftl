import { describe, expect, it } from 'vitest';
import {
  JobC, ShipC, TraderC, YardCrewC, builtCount, deserialize, isLiveOrder, serialize, yardPrice, yardService,
} from '../sim';
import { content } from './index';
import { outline, planHull, run, yardGame } from './yardFixture';

// Soak tier: the full-length versions of the save/load-midway and called-off yard crew runs. yardCrew.test.ts stops near the moment each tests;
// yardCrew.slow.test.ts holds the small order and the consent grant to their ends.
describe('the yard crew, full runs (soak)', () => {
  it('the order survives a save and load midway', () => {
    const { sim, station, me } = yardGame();
    planHull(sim, me, outline(sim, me, 8, -2, 4, 3));
    sim.enqueue({ type: 'yard.order', station });
    run(sim, 1);
    const order = sim.yard.orders[0]!;
    run(sim, 2000, () => order.phase === 'work' && order.timer > 100); // the crew have landed (on the site's run) and are at work
    expect(order.phase).toBe('work');
    const back = deserialize(serialize(sim), content);
    expect(back.yard.orders[0]).toEqual(order);
    const o = back.yard.orders[0]!;
    run(back, 7000, () => !isLiveOrder(o));
    expect(o.phase).toBe('done');
    expect(builtCount(back, o).floor).toBe(2);
    expect(back.world.get(me, ShipC)!.width).toBe(sim.world.get(me, ShipC)!.width);
  }, 120000);

  it('calling the yard crew off mid-work sends them home and refunds the part that was not built', () => {
    const { sim, station, me } = yardGame();
    const trader = sim.world.get(station, TraderC)!;
    const wallet = trader.credits;
    const credits = sim.trade.credits;
    planHull(sim, me, outline(sim, me, 8, -2, 4, 3));
    const hull = yardPrice(sim, yardService(sim, station)!, 12);
    sim.enqueue({ type: 'yard.order', station });
    run(sim, 1);
    const order = sim.yard.orders[0]!;
    run(sim, 6000, () => builtCount(sim, order).walls >= 2); // the truss pass is done and some hull stands
    const b = builtCount(sim, order);
    expect(b.truss).toBe(12);
    expect(b.floor + b.walls).toBeGreaterThan(0);
    expect(b.floor + b.walls).toBeLessThan(12);
    sim.enqueue({ type: 'yard.cancel', order: order.id });
    run(sim, 1);
    // The unbuilt part is back with the player at once; the jobs are gone. The planning fee is earned for the trusses built, the hull price for the hull built.
    const built = builtCount(sim, order);
    const paid = {
      credits: Math.floor((hull.credits * (built.floor + built.walls)) / 12) + Math.floor((24 * built.truss) / 12),
      metal: Math.floor((hull.metal * (built.floor + built.walls)) / 12),
    };
    expect(sim.trade.credits).toBe(credits - paid.credits);
    expect(order.held.credits).toBe(paid.credits);
    expect(order.held.metal).toBe(paid.metal);
    expect(sim.world.query(JobC).filter((j) => sim.world.get(j, JobC)!.yard === order.id)).toHaveLength(0);
    // The crew walk back to the shuttle and fly home; then the built part is paid to the station.
    run(sim, 4000, () => !isLiveOrder(order));
    expect(order.phase).toBe('done');
    expect(order.reason).toBe('called off');
    expect(trader.credits).toBe(wallet + paid.credits);
    expect(sim.trade.credits).toBe(credits - paid.credits);
    expect(sim.world.query(YardCrewC)).toHaveLength(0);
    // What was built stays.
    expect(builtCount(sim, order)).toEqual(built);
  }, 120000);
});
