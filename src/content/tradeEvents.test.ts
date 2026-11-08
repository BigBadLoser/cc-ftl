import { describe, expect, it } from 'vitest';
import { ShipC, newGame, type Sim, type SimEvent } from '../sim';
import { isLive } from '../sim/trade/deals';
import { spawnContact } from '../sim/galaxy/arrivals';
import { CombatC } from '../sim/combat/components';
import { liftShip } from '../sim/sector/packet';
import { wreckShip } from '../sim/combat/wreck';
import { FTL_CHARGE_SEC } from '../sim/tuning';
import { content } from './index';

type Of<T extends SimEvent['type']> = Extract<SimEvent, { type: T }>;

/** A started game with a hailed trading outpost; every event drained from here on is collected in `events`. */
function setup(): { sim: Sim; st: number; events: SimEvent[] } {
  const sim = newGame(1, content);
  const events: SimEvent[] = [];
  sim.enqueue({ type: 'debug.spawnStation', kind: 'station.trading', size: 'outpost', seed: 4 });
  sim.step();
  const st = sim.world.query(ShipC).find((i) => sim.world.get(i, ShipC)!.immobile)!;
  sim.enqueue({ type: 'trade.hail', ship: st });
  sim.step();
  sim.events.drain();
  return { sim, st, events };
}
function step(sim: Sim, events: SimEvent[]): void {
  sim.step();
  events.push(...sim.events.drain());
}
function trade(sim: Sim, events: SimEvent[], st: number, give: { item: string; count: number }[], get: { item: string; count: number }[]): void {
  sim.enqueue({ type: 'trade.offer', ship: st, give, get });
  step(sim, events);
  sim.enqueue({ type: 'trade.accept', offer: sim.trade.offers.find((o) => o.ship === st)!.id });
  step(sim, events);
  for (let i = 0; i < 20000 && sim.trade.deals.some(isLive); i++) step(sim, events);
}
const phases = (events: SimEvent[]) => events.filter((e): e is Of<'trade.phase'> => e.type === 'trade.phase');

describe('trade.phase', () => {
  it('reports every phase of a run to a station, each starting where the last ended, with the shuttle launched', () => {
    const { sim, st, events } = setup();
    trade(sim, events, st, [{ item: 'item.metal', count: 5 }], [{ item: 'item.polymer', count: 5 }]);
    const ph = phases(events);
    expect(ph[0]).toMatchObject({ from: null, to: 'dispatch', ship: st });
    ph.slice(1).forEach((e, i) => expect(e.from).toBe(ph[i]!.to));
    const seq = ph.map((e) => e.to);
    for (const p of ['load', 'out', 'dockStation', 'stationWork'] as const) expect(seq).toContain(p);
    expect(seq.indexOf('out')).toBeLessThan(seq.indexOf('dockStation'));
    expect(seq[seq.length - 1]).toBe('done');
    expect(ph.find((e) => e.to === 'dockStation')!.dock).toBeGreaterThan(0);
    expect(ph.find((e) => e.to === 'out')!.vehicle).toBeGreaterThan(0);
  });

  it('reports a queued deal starting later, and a called-off deal with its reason', () => {
    const { sim, st, events } = setup();
    sim.enqueue({ type: 'trade.offer', ship: st, give: [], get: [{ item: 'item.metal', count: 5 }] });
    step(sim, events);
    sim.enqueue({ type: 'trade.accept', offer: sim.trade.offers[0]!.id });
    step(sim, events);
    sim.enqueue({ type: 'trade.offer', ship: st, give: [], get: [{ item: 'item.metal', count: 5 }] });
    step(sim, events);
    sim.enqueue({ type: 'trade.accept', offer: sim.trade.offers[0]!.id });
    step(sim, events);
    const second = sim.trade.deals[1]!;
    expect(phases(events).filter((e) => e.deal === second.id).map((e) => [e.from, e.to])).toEqual([[null, 'queued']]);
    sim.enqueue({ type: 'trade.cancel', id: second.id });
    step(sim, events);
    expect(phases(events).filter((e) => e.deal === second.id).pop()).toMatchObject({ from: 'queued', to: 'failed', reason: 'cancelled' });
  });
});

describe('vehicle events in a trade run', () => {
  it('a player shuttle run launches, docks at the station, undocks, docks at home and is stowed again', () => {
    const { sim, st, events } = setup();
    trade(sim, events, st, [], [{ item: 'item.metal', count: 5 }]);
    for (let i = 0; i < 2000; i++) step(sim, events);
    const vehicle = events.filter((e): e is Of<'trade.phase'> => e.type === 'trade.phase').find((e) => e.to === 'out')!.vehicle;
    const mine = events.filter((e) => 'vehicle' in e && e.vehicle === vehicle && e.type.startsWith('vehicle.'));
    const kinds = mine.map((e) => e.type);
    expect(kinds.slice(0, 4)).toEqual(['vehicle.launched', 'vehicle.docked', 'vehicle.undocked', 'vehicle.docked']);
    expect(kinds).toContain('vehicle.stowed');
    expect((mine[1] as Of<'vehicle.docked'>).ship).toBe(st);
    expect((mine[3] as Of<'vehicle.docked'>).ship).not.toBe(st);
  });
});

describe('ship.arrived and ship.departed', () => {
  const contact = (id: number) => ({ id, faction: 'zealots', shipgen: 'faction.zealot', seed: id === 9001 ? 12 : 5, depth: 3, since: 0 });

  it('spawnContact reports the arrival with its reason, wherever it was called from', () => {
    const sim = newGame(1, content);
    const c = contact(9001);
    expect(spawnContact(sim, sim.galaxy.current, c, { reason: 'scene' })).toBe(true);
    const e = sim.events.drain().find((x): x is Of<'ship.arrived'> => x.type === 'ship.arrived')!;
    expect(e).toMatchObject({ ship: (c as { ship?: number }).ship, owner: 'zealots', reason: 'scene' });
    expect(e.name).toBe(sim.world.get(e.ship as number, ShipC)!.name);
    const arrived = (): Of<'ship.arrived'>[] => sim.events.drain().filter((x): x is Of<'ship.arrived'> => x.type === 'ship.arrived');
    const sim2 = newGame(1, content);
    spawnContact(sim2, sim2.galaxy.current, contact(9002));
    expect(sim2.events.drain().find((x): x is Of<'ship.arrived'> => x.type === 'ship.arrived')!.reason).toBe('spawn');
    expect(arrived()).toEqual([]);
  });

  it('lifting a ship in play reports its departure; wrecking one reports it destroyed; the player is never reported', () => {
    const sim = newGame(1, content);
    const me = sim.world.query(ShipC).find((i) => sim.world.get(i, ShipC)!.faction === 'player')!;
    sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.raider', x: 100, y: 50 });
    sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.raider', x: 170, y: 10 });
    sim.step();
    sim.events.drain();
    const [sa, sb] = sim.world.query(ShipC).filter((i) => sim.world.get(i, ShipC)!.faction === 'hostile') as [number, number];
    liftShip(sim, sa, { reason: 'fleet' });
    wreckShip(sim, sb);
    const out = sim.events.drain().filter((x): x is Of<'ship.departed'> => x.type === 'ship.departed');
    expect(out.map((x) => [x.ship, x.reason])).toEqual([[sa, 'fleet'], [sb, 'wrecked']]);
    liftShip(sim, me);
    expect(sim.events.drain().some((x) => x.type === 'ship.departed')).toBe(false);
  });

  it('a hostile ship that jumps away reports it once, and lifting it afterwards adds nothing', () => {
    const sim = newGame(1, content);
    sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.raider', x: 100, y: 50 });
    sim.step();
    sim.events.drain();
    const raider = sim.world.query(ShipC, CombatC).find((i) => sim.world.get(i, ShipC)!.faction === 'hostile')!;
    sim.world.get(raider, CombatC)!.ftl = FTL_CHARGE_SEC;
    sim.enqueue({ type: 'combat.flee', ship: raider });
    sim.step();
    liftShip(sim, raider);
    const out = sim.events.drain().filter((x): x is Of<'ship.departed'> => x.type === 'ship.departed');
    expect(out.map((x) => [x.ship, x.reason])).toEqual([[raider, 'fled']]);
  });
});
