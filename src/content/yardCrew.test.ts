import { describe, expect, it } from 'vitest';
import {
  AirlockC, CrewC, ItemStackC, JobC, PositionC, VehicleC, YardCrewC, builtCount, deserialize, isLiveOrder, serialize, yardPrice, yardService,
} from '../sim';
import { jobFits } from '../sim/crew/jobFit';
import { drawAir, sourceSupply } from '../sim/eva/airLedger';
import { SuitC } from '../sim/eva/components';
import { spillItems } from '../sim/items/stacks';
import { suitDef } from '../sim/eva/suit';
import { AllegianceC } from '../sim/fight/components';
import { ConsentC } from '../sim/consent/components';
import { guestOn } from '../sim/consent/guests';
import { isInvader, isOffDuty } from '../sim/fight/relations';
import { shipIdOf } from '../sim/regions';
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
    const timer = order.timer;
    run(back, 200);
    run(sim, 200);
    expect(serialize(back)).toBe(serialize(sim)); // save and load is exact: both games replay identically
    expect(isLiveOrder(o)).toBe(true); // the reloaded order carries on (to its end: yardCrew.slow.test.ts)
    expect(o.reason).toBeUndefined();
    expect(o.timer).toBeGreaterThan(timer);
  });

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
    run(sim, 1);
    expect(sim.world.get(me, ConsentC)?.grants.length ?? 0).toBeGreaterThan(0); // the grant stays while the crew walk home (it goes when the order ends: yardCrew.slow.test.ts)
  });

  it('calling the yard crew off mid-work refunds the part that was not built', () => {
    const { sim, station, me } = yardGame();
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
    // (the crew walk back to the shuttle and the built part is paid to the station in yardCrew.slow.test.ts)
    expect(order.reason).toBe('called off');
  });

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
    expect(builtCount(sim, sim.yard.orders[0]!).truss).toBeGreaterThan(0);
  });

  it('a contractor refilling at the player airlock the station shuttle is docked at draws the shuttle air first; the ship crew draw the airlock store', () => {
    const { sim, station, me } = yardGame();
    planHull(sim, me, outline(sim, me, 8, -2, 4, 3));
    sim.enqueue({ type: 'yard.order', station });
    run(sim, 1);
    const order = sim.yard.orders[0]!;
    run(sim, 2000, () => order.phase === 'work');
    const v = sim.world.get(order.vehicle, VehicleC)!;
    expect(v).toMatchObject({ state: 'docked', dock: order.airlock });
    const lock = sim.world.get(order.airlock, AirlockC)!;
    const [contractor] = order.crew as [number];
    const ours = sim.world.query(CrewC).find((c) => !sim.world.has(c, YardCrewC) && sim.world.get(c, AllegianceC)?.faction === 'player')!;
    sim.world.add(ours, SuitC, { worn: true, air: 0 });
    const tank = suitDef(sim).airSec;
    for (const c of [contractor, ours]) sim.world.get(c, SuitC)!.air = tank / 2;
    lock.air = tank * 2;
    v.air = tank * 2;
    // The contractor's own shuttle first: the player's store is left alone.
    expect(drawAir(sim, contractor, { kind: 'airlock', id: order.airlock })).toBe(tank / 2);
    expect(v.air).toBe(tank * 1.5);
    expect(lock.air).toBe(tank * 2);
    // The ship's own crew draw the airlock's store: the station's shuttle is not theirs to empty.
    expect(drawAir(sim, ours, { kind: 'airlock', id: order.airlock })).toBe(tank / 2);
    expect(lock.air).toBe(tank * 1.5);
    expect(v.air).toBe(tank * 1.5);
    lock.air = 0;
    expect(sourceSupply(sim, { kind: 'airlock', id: order.airlock }, { for: ours })).toBe(0);
    expect(sourceSupply(sim, { kind: 'airlock', id: order.airlock }, { for: contractor })).toBe(tank * 1.5);
  });

  it('the yard site on the player ship leaves the ship crew hauling its loose items (the site carries no loot)', () => {
    const { sim, station, me } = yardGame();
    planHull(sim, me, outline(sim, me, 8, -2, 4, 3));
    sim.enqueue({ type: 'yard.order', station });
    run(sim, 1);
    const order = sim.yard.orders[0]!;
    run(sim, 2000, () => order.phase === 'work');
    const ours = sim.world.query(CrewC).find((c) => !sim.world.has(c, YardCrewC) && sim.world.get(c, AllegianceC)?.faction === 'player')!;
    const at = sim.world.get(ours, PositionC)!;
    const before = new Set(sim.world.query(ItemStackC));
    expect(spillItems(sim, me, Math.round(at.x), Math.round(at.y), 'item.metal', 5)).toBe(0);
    const stack = sim.world.query(ItemStackC).find((s) => !before.has(s))!;
    expect(stack).toBeDefined();
    const hauled = (): boolean => sim.world.query(JobC).some((j) => sim.world.get(j, JobC)!.haul?.src.id === stack);
    run(sim, 60, hauled);
    expect(hauled()).toBe(true);
  });
});
