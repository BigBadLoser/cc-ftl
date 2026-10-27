import { describe, expect, it } from 'vitest';
import {
  AirlockC, CrewC, JobC, PositionC, ShipC, TraderC, VehicleC, YardCrewC, airlockSuits, builtCount, deserialize, hullLoad, isLiveOrder, quoteYard, serialize, Struct, shipGrid, totalTiles, yardPrice, yardService,
} from '../sim';
import { jobFits } from '../sim/crew/jobFit';
import { content } from './index';
import { outline, planHull, run, yardGame } from './yardFixture';

describe('the yard crew', () => {
  it('works in rows: the nearest row first, and a row more than one ahead waits', () => {
    const { sim, station, me } = yardGame();
    planHull(sim, me, outline(sim, me, 8, -6, 6, 7));
    sim.enqueue({ type: 'yard.order', station });
    run(sim, 1);
    const order = sim.yard.orders[0]!;
    const jobs = sim.world.query(JobC).map((id) => sim.world.get(id, JobC)!).filter((j) => j.yard === order.id);
    const ranks = jobs.map((j) => j.yardRank!);
    expect(Math.max(...ranks)).toBeGreaterThan(Math.min(...ranks) + 1);
    expect(order.rank).toBe(Math.min(...ranks));
    const crew = sim.world.query(CrewC, PositionC)[0]!;
    const at = sim.world.get(crew, PositionC)!;
    const fits = (j: (typeof jobs)[number]) => jobFits(sim, crew, at, { ...j, yardOnly: undefined });
    expect(fits(jobs.find((j) => j.yardRank === order.rank)!)).toBe(true);
    expect(fits(jobs.find((j) => j.yardRank! > order.rank + 1)!)).toBe(false);
    order.rank++;
    expect(fits(jobs.find((j) => j.yardRank === order.rank + 1)!)).toBe(true);
  });

  it('a small order is built by the station crew in EVA, they fly home and the escrow settles', () => {
    const { sim, station, me } = yardGame();
    const trader = sim.world.get(station, TraderC)!;
    const wallet = trader.credits;
    const stock = trader.stock.find((s) => s.item === 'item.metal')?.count ?? 0;
    const suits = sim.world.query(AirlockC).reduce((n, a) => n + airlockSuits(sim, a), 0);
    const credits = sim.trade.credits;
    planHull(sim, me, outline(sim, me, 8, -2, 4, 3));
    const quoteHull = quoteYard(sim, station, me).hull.after;
    const price = yardPrice(sim, yardService(sim, station)!, 12);
    sim.enqueue({ type: 'yard.order', station });
    run(sim, 1);
    const order = sim.yard.orders[0]!;
    const phases = new Set<string>();
    const log = run(sim, 3000, () => {
      phases.add(order.phase);
      return !isLiveOrder(order);
    });
    expect(log).toContain('yard.ended');
    expect([...phases]).toEqual(expect.arrayContaining(['fly', 'work', 'seal', 'recall', 'home']));
    expect(order.phase).toBe('done');
    expect(order.reason).toBeUndefined();
    // Every floor tile and wall stands, as ordinary construction made them.
    const grid = shipGrid(sim, me)!;
    for (const t of order.floor) expect(grid.get('struct', t.x, t.y), `floor ${t.x},${t.y}`).toBe(Struct.Floor);
    for (const t of order.walls) expect(grid.get('struct', t.x, t.y), `wall ${t.x},${t.y}`).toBe(Struct.Wall);
    expect(builtCount(sim, order)).toEqual({ floor: 2, walls: 10 });
    expect(totalTiles(order)).toBe(12);
    // Nobody (the ship's own crew, who also build, included) is walled in.
    const keys = new Set(order.floor.map((t) => `${t.x},${t.y}`));
    expect(sim.world.query(CrewC, PositionC).filter((c) => keys.has(`${sim.world.get(c, PositionC)!.x},${sim.world.get(c, PositionC)!.y}`))).toEqual([]);
    // The new walls are hull tiles the engines have to carry, and the ship owns the new tiles.
    expect(hullLoad(sim, me).tiles).toBe(quoteHull);
    expect(sim.sector.grid.get('ship', order.floor[0]!.x, order.floor[0]!.y)).toBe(me);
    // The station is paid, the crew and the shuttle are gone, nobody kept a suit.
    expect(sim.trade.credits).toBe(credits - price.credits);
    expect(trader.credits).toBe(wallet + price.credits);
    expect(trader.stock.find((s) => s.item === 'item.metal')?.count ?? 0).toBe(stock + price.metal);
    expect(order.held).toEqual({ credits: 0, metal: 0 });
    expect(sim.world.query(YardCrewC)).toHaveLength(0);
    expect(sim.world.query(VehicleC).filter((v) => sim.world.get(v, VehicleC)!.homeShip === station)).toHaveLength(0);
    expect(sim.world.query(AirlockC).reduce((n, a) => n + airlockSuits(sim, a), 0)).toBe(suits);
    expect(sim.world.query(CrewC).filter((c) => sim.world.get(c, CrewC)!.role === 'role.engineer' && !sim.world.has(c, YardCrewC)).length).toBeGreaterThan(0);
  }, 120000);

  it('the order survives a save and load midway', () => {
    const { sim, station, me } = yardGame();
    planHull(sim, me, outline(sim, me, 8, -2, 4, 3));
    sim.enqueue({ type: 'yard.order', station });
    run(sim, 300);
    const order = sim.yard.orders[0]!;
    expect(order.phase).toBe('work');
    const back = deserialize(serialize(sim), content);
    expect(back.yard.orders[0]).toEqual(order);
    const o = back.yard.orders[0]!;
    run(back, 3000, () => !isLiveOrder(o));
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
    const price = yardPrice(sim, yardService(sim, station)!, 12);
    sim.enqueue({ type: 'yard.order', station });
    run(sim, 1);
    const order = sim.yard.orders[0]!;
    run(sim, 2000, () => builtCount(sim, order).floor + builtCount(sim, order).walls >= 4);
    const done = builtCount(sim, order).floor + builtCount(sim, order).walls;
    expect(done).toBeGreaterThan(0);
    expect(done).toBeLessThan(totalTiles(order));
    sim.enqueue({ type: 'yard.cancel', order: order.id });
    run(sim, 1);
    // The unbuilt part is back with the player at once; the jobs are gone.
    const built = builtCount(sim, order).floor + builtCount(sim, order).walls;
    const paid = { credits: Math.floor((price.credits * built) / totalTiles(order)), metal: Math.floor((price.metal * built) / totalTiles(order)) };
    expect(sim.trade.credits).toBe(credits - paid.credits);
    expect(order.held.credits).toBe(paid.credits);
    expect(sim.world.query(JobC).filter((j) => sim.world.get(j, JobC)!.yard === order.id)).toHaveLength(0);
    // The crew walk back to the shuttle and fly home; then the built part is paid to the station.
    run(sim, 3000, () => !isLiveOrder(order));
    expect(order.phase).toBe('done');
    expect(order.reason).toBe('called off');
    expect(trader.credits).toBe(wallet + paid.credits);
    expect(sim.trade.credits).toBe(credits - paid.credits);
    expect(sim.world.query(YardCrewC)).toHaveLength(0);
    // What was built stays.
    expect(builtCount(sim, order).floor + builtCount(sim, order).walls).toBe(built);
  }, 120000);

  it('the ships own crew can build the yard tiles too', () => {
    const { sim, station, me } = yardGame();
    planHull(sim, me, outline(sim, me, 8, -2, 4, 3));
    sim.enqueue({ type: 'yard.order', station });
    run(sim, 120); // the shuttle has not docked yet
    const ours = sim.world.query(JobC).filter((j) => {
      const by = sim.world.get(j, JobC)!.reservedBy;
      return sim.world.get(j, JobC)!.yard === 1 && by !== 0 && !sim.world.has(by, YardCrewC);
    });
    expect(ours.length).toBeGreaterThan(0);
    run(sim, 700);
    expect(builtCount(sim, sim.yard.orders[0]!).floor).toBeGreaterThan(0);
  }, 120000);
});
