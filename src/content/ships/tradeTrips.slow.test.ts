import { describe, expect, it } from 'vitest';
import { ModuleC, ShipC, StorageC, TraderC, VehicleC, destroyVehicle, newGame, storageAdd, playerItems, type Deal, type Sim, type SimEvent } from '../../sim';
import { MAX_TRIPS, planTrips } from '../../sim/trade/trips';
import { shipIds, shipIdOf } from '../../sim/regions';
import { content } from '../index';

const run = (sim: Sim, n: number): SimEvent[] => {
  const out: SimEvent[] = [];
  for (let i = 0; i < n; i++) {
    sim.step();
    out.push(...sim.events.drain());
  }
  return out;
};
const ofType = <T extends SimEvent['type']>(events: SimEvent[], type: T): Extract<SimEvent, { type: T }>[] =>
  events.filter((e): e is Extract<SimEvent, { type: T }> => e.type === type);

/** A started game with a hailed freighter (it sends its own shuttle: a hold of 24) holding plenty of metal; the first role match found over fixed seeds 1..79, no seed is picked for its outcome. */
function freighter(): { sim: Sim; ship: number } {
  for (let seed = 1; seed < 80; seed++) {
    const sim = newGame(1, content);
    sim.galaxy.fleets = [];
    sim.enqueue({ type: 'debug.spawnGenerated', faction: 'faction.civilian', seed, depth: 2, cx: 130, cy: 70 });
    sim.step();
    sim.events.drain();
    const ship = sim.world.query(ShipC).find((i) => sim.world.get(i, ShipC)!.gen?.role === 'freighter');
    if (!ship) continue;
    sim.enqueue({ type: 'trade.hail', ship });
    run(sim, 2);
    const t = sim.world.get(ship, TraderC)!;
    t.stock = t.stock.filter((s) => s.item !== 'item.metal');
    t.stock.push({ item: 'item.metal', count: 200 });
    sim.enqueue({ type: 'debug.setCredits', value: 100000 });
    run(sim, 1);
    return { sim, ship };
  }
  throw new Error('no freighter found');
}

const metal = (sim: Sim, ship: number): number => sim.world.get(ship, TraderC)!.stock.find((s) => s.item === 'item.metal')?.count ?? 0;

/** Offer and accept a buy of `n` metal; returns the deal's getter and the order's total balance. */
function buy(sim: Sim, ship: number, n: number): { deal: () => Deal; balance: number } {
  sim.enqueue({ type: 'trade.offer', ship, give: [], get: [{ item: 'item.metal', count: n }] });
  const offered = ofType(run(sim, 2), 'trade.offered')[0]!;
  sim.enqueue({ type: 'trade.accept', offer: offered.offer });
  const made = ofType(run(sim, 2), 'trade.dealMade')[0]!;
  return { deal: () => sim.trade.deals.find((d) => d.id === made.deal)!, balance: offered.balance };
}

describe('orders bigger than one hold run as several trips', () => {
  it('a 60-item order from a freighter runs as trips of 24, 24 and 12 and settles trip by trip', () => {
    const { sim, ship } = freighter();
    const t = sim.world.get(ship, TraderC)!;
    const start = { credits: sim.trade.credits, theirs: t.credits, stock: metal(sim, ship), have: playerItems(sim, 'item.metal') };
    const { deal, balance } = buy(sim, ship, 60);
    expect(deal().trip).toMatchObject({ n: 1, of: 3 });
    expect(deal().get).toEqual([{ item: 'item.metal', count: 24 }]);
    // Only the first trip is held: its credits are in escrow and its goods out of the trader's stock.
    expect(sim.trade.credits).toBe(start.credits - deal().held);
    expect(metal(sim, ship)).toBe(start.stock - 24);
    const settled: number[] = [];
    const trips: number[] = [];
    for (let i = 0; i < 30000 && deal().phase !== 'done' && deal().phase !== 'failed'; i++) {
      for (const e of run(sim, 1)) if (e.type === 'trade.settled') settled.push(e.credits);
      const n = deal().trip?.n ?? 0;
      if (trips[trips.length - 1] !== n) trips.push(n);
    }
    expect(deal().phase).toBe('done');
    expect(trips).toEqual([1, 2, 3]);
    expect(settled).toHaveLength(3);
    expect(settled.reduce((a, b) => a + b, 0)).toBe(balance); // the trips add up to the order the player was quoted
    run(sim, 600);
    expect(playerItems(sim, 'item.metal')).toBe(start.have + 60);
    expect(metal(sim, ship)).toBe(start.stock - 60);
    expect(sim.trade.credits).toBe(start.credits - balance);
    expect(t.credits).toBe(start.theirs + balance);
    expect(deal().held).toBe(0);
    expect(sim.world.query(VehicleC).filter((v) => sim.world.get(v, VehicleC)!.homeShip === ship)).toHaveLength(0);
  });

  it('an order called off after the first trip keeps that trip settled and refunds only the one in escrow', () => {
    const { sim, ship } = freighter();
    const t = sim.world.get(ship, TraderC)!;
    const start = { credits: sim.trade.credits, theirs: t.credits, stock: metal(sim, ship), have: playerItems(sim, 'item.metal') };
    const { deal } = buy(sim, ship, 60);
    const first = deal().balance;
    // Run until trip 2 has been started (trip 1 settled), then shoot its courier down.
    for (let i = 0; i < 30000 && deal().trip?.n !== 2; i++) run(sim, 1);
    expect(deal().trip?.n).toBe(2);
    expect(sim.trade.credits).toBe(start.credits - first - deal().held);
    run(sim, 200);
    const courier = sim.world.query(VehicleC).find((v) => sim.world.get(v, VehicleC)!.homeShip === ship);
    expect(courier).toBeDefined();
    destroyVehicle(sim, courier!);
    expect(ofType(run(sim, 3), 'trade.failed')[0]).toMatchObject({ reason: 'lost' });
    // Trip 1 stays settled; trip 2's credits are refunded; trip 2's goods went down with the shuttle; trip 3 was never held.
    expect(deal().held).toBe(0);
    expect(deal().trip?.rest).toEqual([]);
    expect(sim.trade.credits).toBe(start.credits - first);
    expect(t.credits).toBe(start.theirs + first);
    expect(metal(sim, ship)).toBe(start.stock - 48);
    run(sim, 600);
    expect(playerItems(sim, 'item.metal')).toBe(start.have + 24);
  });
});

/** A mining ship (no shuttle of its own: the player's, hold 40, carries everything) and the player's storage stocked with electronics to sell. */
function seller(): { sim: Sim; ship: number } {
  for (let seed = 1; seed < 80; seed++) {
    const sim = newGame(1, content);
    sim.galaxy.fleets = [];
    sim.enqueue({ type: 'debug.spawnGenerated', faction: 'faction.civilian', seed, depth: 2, cx: 130, cy: 70 });
    sim.step();
    sim.events.drain();
    const ship = sim.world.query(ShipC).find((i) => sim.world.get(i, ShipC)!.gen?.role === 'mining');
    if (!ship) continue;
    const crate = sim.world.query(StorageC).find((i) => shipIdOf(sim, sim.world.get(i, ModuleC)) === (shipIds(sim)[0] as number))!;
    storageAdd(sim, crate, 'item.electronics', 60);
    sim.enqueue({ type: 'trade.hail', ship });
    run(sim, 2);
    sim.world.get(ship, TraderC)!.credits = 100000;
    return { sim, ship };
  }
  throw new Error('no mining ship found');
}

function sell(sim: Sim, ship: number, n: number): { deal: () => Deal; balance: number } {
  sim.enqueue({ type: 'trade.offer', ship, give: [{ item: 'item.electronics', count: n }], get: [] });
  const offered = ofType(run(sim, 2), 'trade.offered')[0]!;
  sim.enqueue({ type: 'trade.accept', offer: offered.offer });
  const made = ofType(run(sim, 2), 'trade.dealMade')[0]!;
  return { deal: () => sim.trade.deals.find((d) => d.id === made.deal)!, balance: offered.balance };
}

describe('orders on the player shuttle (hold of 40)', () => {
  it('selling 60 runs as trips of 40 and 20 and the trader is paid trip by trip', () => {
    const { sim, ship } = seller();
    const t = sim.world.get(ship, TraderC)!;
    const start = { credits: sim.trade.credits, theirs: t.credits, have: playerItems(sim, 'item.electronics'), stock: t.stock.find((x) => x.item === 'item.electronics')?.count ?? 0 };
    const { deal, balance } = sell(sim, ship, 60);
    expect(balance).toBeLessThan(0);
    expect(deal().trip).toMatchObject({ n: 1, of: 2 });
    expect(deal().give).toEqual([{ item: 'item.electronics', count: 40 }]);
    for (let i = 0; i < 40000 && deal().phase !== 'done' && deal().phase !== 'failed'; i++) run(sim, 1);
    expect(deal().phase).toBe('done');
    expect(deal().trip).toMatchObject({ n: 2, of: 2 });
    run(sim, 600);
    expect(playerItems(sim, 'item.electronics')).toBe(start.have - 60);
    expect(t.stock.find((x) => x.item === 'item.electronics')!.count).toBe(start.stock + 60);
    expect(sim.trade.credits).toBe(start.credits - balance);
    expect(t.credits).toBe(start.theirs + balance);
    expect(sim.world.get(sim.world.query(VehicleC)[0] as number, VehicleC)!.state).toBe('stowed');
  });

  it('calling the order off between trips keeps the first trip and puts the second back', () => {
    const { sim, ship } = seller();
    const t = sim.world.get(ship, TraderC)!;
    const start = { credits: sim.trade.credits, theirs: t.credits, have: playerItems(sim, 'item.electronics') };
    const { deal } = sell(sim, ship, 60);
    const first = deal().balance;
    for (let i = 0; i < 40000 && deal().trip?.n !== 2; i++) run(sim, 1);
    expect(deal().trip?.n).toBe(2);
    sim.enqueue({ type: 'trade.cancel', id: deal().id });
    expect(ofType(run(sim, 2), 'trade.failed')[0]).toMatchObject({ reason: 'cancelled' });
    run(sim, 3000);
    expect(deal().held).toBe(0);
    expect(sim.trade.credits).toBe(start.credits - first);
    expect(t.credits).toBe(start.theirs + first);
    expect(playerItems(sim, 'item.electronics')).toBe(start.have - 40);
    expect(sim.world.get(sim.world.query(VehicleC)[0] as number, VehicleC)!.state).toBe('stowed');
  });
});

describe('the cap of one trip', () => {
  it('splits by the hold and never puts more than a hold in a trip', () => {
    const { sim, ship } = freighter();
    for (const n of [1, 24, 25, 48, 60, 24 * MAX_TRIPS]) {
      const trips = planTrips(sim, ship, [], [{ item: 'item.metal', count: n }], 24)!;
      expect(trips.length).toBe(Math.ceil(n / 24));
      for (const tr of trips) expect(tr.get.reduce((a, l) => a + l.count, 0)).toBeLessThanOrEqual(24);
      expect(trips.reduce((a, tr) => a + tr.get.reduce((x, l) => x + l.count, 0), 0)).toBe(n);
    }
  });

  it('refuses an order of more than the most trips', () => {
    const { sim, ship } = freighter();
    sim.enqueue({ type: 'trade.offer', ship, give: [], get: [{ item: 'item.metal', count: 24 * MAX_TRIPS + 1 }] });
    const offered = ofType(run(sim, 2), 'trade.offered')[0]!;
    sim.enqueue({ type: 'trade.accept', offer: offered.offer });
    expect(ofType(run(sim, 2), 'command.rejected').map((e) => e.reason)).toEqual(['tooBig']);
    expect(sim.trade.deals).toHaveLength(0);
  });
});
