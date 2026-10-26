import { describe, expect, it } from 'vitest';
import {
  AboardC, DraftedC, StorageC, ShipC, TransferC, VehicleC, deserialize, homeShip, newGame, regionItems, serialize, shipGrid, spawnCrew, storageAdd, storageTake, CrewC, PositionC,
  type Sim, type SimEvent,
} from '../../sim';
import { shipIdOf } from '../../sim/regions';
import { spillItems } from '../../sim/items/stacks';
import { content } from '../index';
import { outpostRegion, shuttleOf, stockOn, storages } from './ferryFixture';

type Ev = SimEvent['type'];
/** Step until `until` says stop; returns every event seen (rejections included). */
function play(sim: Sim, n: number, until?: (all: SimEvent[]) => boolean): SimEvent[] {
  const all: SimEvent[] = [];
  for (let i = 0; i < n; i++) {
    sim.step();
    all.push(...sim.events.drain());
    if (until?.(all)) break;
  }
  return all;
}
const of = <T extends Ev>(all: SimEvent[], type: T): Extract<SimEvent, { type: T }>[] => all.filter((e): e is Extract<SimEvent, { type: T }> => e.type === type);
const orders = (sim: Sim): number[] => [...sim.world.query(TransferC)];
const finished = (all: SimEvent[]): boolean => of(all, 'transfer.delivered').some((e) => e.final);

/** A new game with a base 70 tiles off, a pilot in the crew, and `metal` extra metal in the home storage. */
function setup(opts: { airlock?: boolean; metal?: number } = {}) {
  const sim = newGame(3, content);
  const home = homeShip(sim);
  const base = outpostRegion(sim, 70, 30, opts.airlock ?? false);
  play(sim, 5);
  const pilot = [...sim.world.query(CrewC)].find((c) => sim.world.get(c, CrewC)?.role === 'role.pilot')!; // the starting crew has one
  const crate = storages(sim, home)[0]!;
  if (opts.metal) storageAdd(sim, crate, 'item.metal', opts.metal);
  return { sim, home, base, pilot };
}

describe('logistics: transfer orders', () => {
  it('queues an order, picks the shuttle and the pilot by itself, and delivers', () => {
    const { sim, home, base, pilot } = setup({ metal: 30 });
    const metal0 = stockOn(sim, home, 'item.metal');
    sim.enqueue({ type: 'transfer.order', from: home, to: base, items: [{ item: 'item.metal', count: 25 }] });
    const all = play(sim, 9000, (a) => finished(a) && of(a, 'ferry.done').length > 0);
    expect(of(all, 'transfer.queued')).toMatchObject([{ from: home, to: base, items: 25, auto: false }]);
    const go = of(all, 'transfer.underway');
    expect(go).toHaveLength(1);
    expect(go[0]).toMatchObject({ vehicle: shuttleOf(sim), pilot, trip: 1, items: 25 });
    expect(of(all, 'transfer.delivered')).toMatchObject([{ items: 25, left: 0, final: true }]);
    expect(stockOn(sim, base, 'item.metal')).toBe(25);
    expect(stockOn(sim, home, 'item.metal')).toBe(metal0 - 25);
    expect(orders(sim)).toEqual([]);
    // The pilot flew it and is back at work; the shuttle is parked.
    expect(sim.world.has(pilot, AboardC)).toBe(false);
    expect(sim.world.has(pilot, DraftedC)).toBe(false);
    expect(sim.world.get(shuttleOf(sim), VehicleC)).toMatchObject({ state: 'stowed', pilot: 0, autopilot: false });
  });

  it('prefers a real pilot over other free crew', () => {
    const { sim, home, base, pilot } = setup({ metal: 10 });
    sim.enqueue({ type: 'transfer.order', from: home, to: base, items: [{ item: 'item.metal', count: 5 }] });
    const all = play(sim, 600, (a) => of(a, 'transfer.underway').length > 0);
    expect(of(all, 'transfer.underway')[0]!.pilot).toBe(pilot);
  });

  it('splits a load larger than the hold into several trips', () => {
    const { sim, home, base } = setup({ metal: 100 });
    const hold = content.vehicles['vehicle.shuttle']!.cargo!;
    const metal0 = stockOn(sim, home, 'item.metal');
    const want = hold * 2 + 5;
    sim.enqueue({ type: 'transfer.order', from: home, to: base, items: [{ item: 'item.metal', count: want }] });
    const all = play(sim, 30000, (a) => finished(a));
    expect(of(all, 'transfer.underway').map((e) => [e.trip, e.items])).toEqual([[1, hold], [2, hold], [3, 5]]);
    expect(of(all, 'transfer.delivered').map((e) => e.final)).toEqual([false, false, true]);
    expect(stockOn(sim, base, 'item.metal')).toBe(want);
    expect(stockOn(sim, home, 'item.metal')).toBe(metal0 - want);
  });

  it('waits while no pilot is free, then resumes by itself', () => {
    const { sim, home, base } = setup({ metal: 10 });
    const everyone = [...sim.world.query(CrewC)];
    for (const c of everyone) sim.world.add(c, DraftedC, { target: null });
    sim.enqueue({ type: 'transfer.order', from: home, to: base, items: [{ item: 'item.metal', count: 5 }] });
    const first = play(sim, 300);
    expect(of(first, 'transfer.blocked')).toMatchObject([{ reason: 'noPilot' }]);
    expect(sim.world.get(orders(sim)[0]!, TransferC)).toMatchObject({ status: 'blocked', reason: 'noPilot' });
    for (const c of everyone) sim.world.remove(c, DraftedC);
    const rest = play(sim, 9000, finished);
    expect(of(rest, 'transfer.underway')).toHaveLength(1);
    expect(stockOn(sim, base, 'item.metal')).toBe(5);
  });

  it('waits while the shuttle is busy with a hand-made run, then goes', () => {
    const { sim, home, base } = setup({ metal: 20 });
    sim.enqueue({ type: 'ferry.order', from: home, to: base, items: [{ item: 'item.metal', count: 3 }] });
    play(sim, 5);
    sim.enqueue({ type: 'transfer.order', from: home, to: base, items: [{ item: 'item.metal', count: 8 }] });
    const all = play(sim, 12000, finished);
    expect(of(all, 'transfer.blocked').map((e) => e.reason)).toContain('noShuttle');
    expect(stockOn(sim, base, 'item.metal')).toBe(11);
  });

  it('blocks with noStock when the pickup runs dry and resumes when goods arrive', () => {
    const { sim, home, base } = setup({ metal: 10 });
    sim.enqueue({ type: 'transfer.order', from: home, to: base, items: [{ item: 'item.metal', count: 10 }] });
    play(sim, 1);
    // Strip the metal out before the order's first look for a shuttle.
    const stripped = storages(sim, home).map((c) => [c, storageTake(sim, c, 'item.metal', 9999)] as const);
    const first = play(sim, 400);
    expect(of(first, 'transfer.blocked')).toMatchObject([{ reason: 'noStock' }]);
    expect(of(first, 'transfer.underway')).toHaveLength(0);
    for (const [c, n] of stripped) storageAdd(sim, c, 'item.metal', n);
    const rest = play(sim, 9000, finished);
    expect(of(rest, 'transfer.delivered')).toMatchObject([{ final: true }]);
    expect(stockOn(sim, base, 'item.metal')).toBe(10);
  });

  it('cancel stops a queued order and leaves the goods where they are', () => {
    const { sim, home, base } = setup({ metal: 10 });
    const everyone = [...sim.world.query(CrewC)];
    for (const c of everyone) sim.world.add(c, DraftedC, { target: null });
    sim.enqueue({ type: 'transfer.order', from: home, to: base, items: [{ item: 'item.metal', count: 5 }] });
    play(sim, 100);
    const [id] = orders(sim);
    sim.enqueue({ type: 'transfer.cancel', order: id! });
    const all = play(sim, 5);
    expect(of(all, 'transfer.cancelled')).toMatchObject([{ order: id, reason: 'player' }]);
    expect(orders(sim)).toEqual([]);
    expect(stockOn(sim, base, 'item.metal')).toBe(0);
  });

  it('cancel during the pickup recalls the shuttle; goods stay home', () => {
    const { sim, home, base, pilot } = setup({ metal: 10 });
    const metal0 = stockOn(sim, home, 'item.metal');
    sim.enqueue({ type: 'transfer.order', from: home, to: base, items: [{ item: 'item.metal', count: 5 }] });
    play(sim, 800, (a) => of(a, 'transfer.underway').length > 0);
    sim.enqueue({ type: 'transfer.cancel', order: orders(sim)[0]! });
    const all = play(sim, 6000, (a) => of(a, 'ferry.done').length > 0);
    expect(of(all, 'transfer.cancelled')).toHaveLength(1);
    expect(of(all, 'transfer.delivered')).toHaveLength(0);
    expect(stockOn(sim, base, 'item.metal')).toBe(0);
    expect(stockOn(sim, home, 'item.metal')).toBe(metal0);
    expect(sim.world.has(pilot, AboardC)).toBe(false);
  });

  it('rejects empty, same-region and unknown orders', () => {
    const { sim, home, base } = setup();
    sim.enqueue({ type: 'transfer.order', from: home, to: home, items: [{ item: 'item.metal', count: 1 }] });
    sim.enqueue({ type: 'transfer.order', from: home, to: base, items: [] });
    sim.enqueue({ type: 'transfer.cancel', order: 99999 });
    const all = play(sim, 2);
    expect(of(all, 'command.rejected').map((e) => e.reason)).toEqual(['sameRegion', 'nothing', 'noOrder']);
  });

  it('survives a save and load with an order under way', () => {
    const { sim, home, base } = setup({ metal: 10 });
    sim.enqueue({ type: 'transfer.order', from: home, to: base, items: [{ item: 'item.metal', count: 6 }] });
    play(sim, 300);
    const b = deserialize(serialize(sim), content);
    expect(orders(b)).toHaveLength(1);
    play(b, 9000, finished);
    expect(stockOn(b, base, 'item.metal')).toBe(6);
  });
});

describe('logistics: salvage auto-transfer', () => {
  /** A stand-in derelict: a captured prize 70 tiles off with loot on its floor and one boarder aboard. */
  function prizeSite(units: number) {
    const s = setup({});
    const site = outpostRegion(s.sim, 100, 60, false);
    const ship = s.sim.world.get(site, ShipC)!;
    Object.assign(ship, { state: 'prize' });
    spawnCrew(s.sim, site, ['role.engineer']);
    for (const c of storages(s.sim, site)) for (const st of [...(s.sim.world.get(c, StorageC)?.stacks ?? [])]) storageTake(s.sim, c, st.item, st.count); // an empty crate
    const g = shipGrid(s.sim, site)!;
    spillItems(s.sim, site, g.x0 + 5, g.y0 + 5, 'item.metal', units);
    return { ...s, site };
  }

  it('queues a transfer home by itself once the salvage goes quiet, and the loot arrives', () => {
    const { sim, home, site } = prizeSite(12);
    const total = regionItems(sim, site, 'item.metal');
    expect(total).toBe(12);
    const metal0 = stockOn(sim, home, 'item.metal');
    const all = play(sim, 15000, (a) => finished(a));
    expect(of(all, 'transfer.queued')).toMatchObject([{ from: site, to: home, items: 12, auto: true }]);
    expect(regionItems(sim, site, 'item.metal')).toBe(0);
    expect(stockOn(sim, home, 'item.metal') - metal0).toBe(12);
  });

  it('does not queue anything for a site nobody of ours works on', () => {
    const { sim, site } = prizeSite(12);
    for (const c of sim.world.query(CrewC)) if (shipIdOf(sim, sim.world.get(c, PositionC)) === site) sim.world.remove(c, PositionC);
    expect(play(sim, 2000).filter((e) => e.type === 'transfer.queued')).toEqual([]);
  });

  it('queues at once when the loot fills a shuttle, one order per site', () => {
    const { sim, site } = prizeSite(45);
    // Keep the boarder off hauling: carried goods are not counted, and how soon it picks them up depends on the crew list.
    for (const c of sim.world.query(CrewC)) if (shipIdOf(sim, sim.world.get(c, PositionC)) === site) sim.enqueue({ type: 'crew.setPriority', id: c, category: 'hauling', value: 0 });
    const all = play(sim, 120);
    expect(of(all, 'transfer.queued')).toHaveLength(1);
    expect(of(all, 'transfer.queued')[0]).toMatchObject({ from: site, items: 45, auto: true });
    expect(site).toBeGreaterThan(0);
  });
});
