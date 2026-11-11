import { describe, expect, it } from 'vitest';
import {
  CrewC, PositionC, TraderC, VehicleC, YardCrewC, SuitC, builtCount, hullLoad, isLiveOrder, quoteYard, Struct, shipGrid, totalTiles, yardPrice, yardService,
} from '../sim';
import { ConsentC } from '../sim/consent/components';
import { guestOn } from '../sim/consent/guests';
import { isInvader, isOffDuty } from '../sim/fight/relations';
import { shipIdOf } from '../sim/regions';
import { outline, planHull, run, yardGame } from './yardFixture';

// Slow tier: the full-length yard crew runs (each takes the order from the dock to done or called off). yardCrew.test.ts holds the
// short versions that stop near the moment they test.
describe('the yard crew, full runs', () => {
  it('a small order is built by the station crew in EVA, they fly home and the escrow settles', () => {
    const { sim, station, me } = yardGame();
    const trader = sim.world.get(station, TraderC)!;
    const wallet = trader.credits;
    const credits = sim.trade.credits;
    planHull(sim, me, outline(sim, me, 8, -2, 4, 3));
    const quoteHull = quoteYard(sim, station, me).hull.after;
    const hull = yardPrice(sim, yardService(sim, station)!, 12);
    const price = { credits: hull.credits + 24, metal: hull.metal }; // plus the planning fee: 12 trusses at 2 credits
    sim.enqueue({ type: 'yard.order', station });
    run(sim, 1);
    const order = sim.yard.orders[0]!;
    const phases = new Set<string>();
    const log = run(sim, 7000, () => {
      phases.add(order.phase);
      return !isLiveOrder(order);
    });
    expect(log).toContain('yard.ended');
    expect([...phases]).toEqual(expect.arrayContaining(['fly', 'work', 'seal', 'recall', 'home']));
    expect(order.phase).toBe('done');
    expect(order.reason).toBeUndefined();
    // Every floor tile and wall stands, as ordinary construction made them; the wall row laid against the old hull (the plan's south side, between
    // its corners) was turned inward, so it was opened into floor with the old hull behind it (#385).
    const grid = shipGrid(sim, me)!;
    const south = Math.max(...order.walls.map((t) => t.y));
    const [west, east] = [Math.min(...order.walls.map((t) => t.x)), Math.max(...order.walls.map((t) => t.x))];
    const inward = (t: { x: number; y: number }): boolean => t.y === south && t.x !== west && t.x !== east;
    for (const t of order.floor) expect(grid.get('struct', t.x, t.y), `floor ${t.x},${t.y}`).toBe(Struct.Floor);
    for (const t of order.walls) expect(grid.get('struct', t.x, t.y), `wall ${t.x},${t.y}`).toBe(inward(t) ? Struct.Floor : Struct.Wall);
    for (const t of order.walls.filter(inward)) expect(grid.get('struct', t.x, t.y + 1), `old hull ${t.x},${t.y + 1}`).toBe(Struct.Floor);
    expect(builtCount(sim, order)).toEqual({ truss: 12, floor: 2, walls: 10 });
    expect(totalTiles(order)).toBe(24);
    // Nobody (the ship's own crew, who also build, included) is walled in.
    const keys = new Set(order.floor.map((t) => `${t.x},${t.y}`));
    expect(sim.world.query(CrewC, PositionC).filter((c) => keys.has(`${sim.world.get(c, PositionC)!.x},${sim.world.get(c, PositionC)!.y}`))).toEqual([]);
    // The new walls are hull tiles the engines have to carry, and the ship owns the new tiles.
    expect(hullLoad(sim, me).tiles).toBe(quoteHull);
    expect(sim.sector.grid.get('ship', order.floor[0]!.x, order.floor[0]!.y)).toBe(me);
    // The station is paid, the crew and the shuttle are gone, nobody kept a suit.
    expect(sim.trade.credits).toBe(credits - price.credits);
    expect(trader.credits).toBe(wallet + price.credits);
    // (the station's own metal stock moves with its trade over a run this long, so only the escrow is checked for metal)
    expect(order.held).toEqual({ credits: 0, metal: 0 });
    expect(sim.world.query(YardCrewC)).toHaveLength(0);
    expect(sim.world.query(VehicleC).filter((v) => sim.world.get(v, VehicleC)!.homeShip === station)).toHaveLength(0);
    run(sim, 1200); // the ship's own crew, who also worked outside, come back in and hang their suits up
    expect(sim.world.query(SuitC).filter((c) => shipIdOf(sim, sim.world.get(c, PositionC)!) === me)).toEqual([]);
    expect(sim.world.query(CrewC).filter((c) => sim.world.get(c, CrewC)!.role === 'role.engineer' && !sim.world.has(c, YardCrewC)).length).toBeGreaterThan(0);
  }, 120000);

  it('the contractors are aboard by a working consent grant (not invaders, on duty); the grant goes with the order', () => {
    const { sim, station, me } = yardGame();
    planHull(sim, me, outline(sim, me, 8, -2, 4, 3));
    sim.enqueue({ type: 'yard.order', station });
    run(sim, 1);
    const order = sim.yard.orders[0]!;
    expect(sim.world.get(me, ConsentC)?.grants).toEqual([expect.objectContaining({ by: 'yard', faction: 'neutral', site: me, work: true, from: station })]);
    const onMe = (c: number): boolean => sim.world.has(c, PositionC) && shipIdOf(sim, sim.world.get(c, PositionC)!) === me;
    run(sim, 2000, () => order.crew.some(onMe));
    const c = order.crew.find(onMe)!;
    expect(c).toBeDefined();
    expect(guestOn(sim, c, me)).toBe(true);
    expect(isInvader(sim, c)).toBe(false);
    expect(isOffDuty(sim, c)).toBe(false);
    sim.enqueue({ type: 'yard.cancel', order: order.id });
    run(sim, 4000, () => !isLiveOrder(order));
    expect(isLiveOrder(order)).toBe(false);
    expect(sim.world.has(me, ConsentC)).toBe(false);
  }, 120000);

});
