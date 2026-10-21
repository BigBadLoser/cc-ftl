import { describe, expect, it } from 'vitest';
import {
  destroyVehicle, CarryingC, CrewC, ModuleC, PositionC, ShipC, StorageC, TraderC, VehicleC, deserialize, newGame, playerItems, serialize, storageCount, storageAdd,
  type Sim, type SimEvent,
} from '../../sim';
import { content } from '../index';
import { shipIdOf } from '../../sim/regions';
import { shipIds } from '../../sim/regions';

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

/** A started game with a generated civilian ship of the wanted role in the node (searching seeds for it). */
function withCivilian(role: string, gameSeed = 1): { sim: Sim; ship: number } {
  for (let seed = 1; seed < 80; seed++) {
    const sim = newGame(gameSeed, content);
    sim.enqueue({ type: 'debug.spawnGenerated', faction: 'faction.civilian', seed, depth: 2, cx: 130, cy: 70 });
    sim.step();
    sim.events.drain();
    const ship = sim.world.query(ShipC).find((i) => sim.world.get(i, ShipC)!.gen?.role === role);
    if (ship) return { sim, ship };
  }
  throw new Error(`no civilian ${role} found`);
}

/** The starter's engineer climbs into the shuttle as pilot. */
function crewPilot(sim: Sim): number {
  const shuttle = sim.world.query(VehicleC)[0] as number;
  const crew = sim.world.query(CrewC).find((c) => shipIdOf(sim, sim.world.get(c, PositionC)) === shipIds(sim)[0] as number) as number;
  sim.enqueue({ type: 'vehicle.embark', crew, vehicle: shuttle });
  run(sim, 400);
  expect(sim.world.get(shuttle, VehicleC)!.pilot).toBe(crew);
  return shuttle;
}

const stored = (sim: Sim, item: string): number => playerItems(sim, item);

describe('trade, end to end', () => {
  it('buy from a freighter: its shuttle docks at the unloaders, crew haul the cargo into storage, then payment settles', () => {
    const { sim, ship } = withCivilian('freighter');
    sim.enqueue({ type: 'trade.hail', ship });
    expect(ofType(run(sim, 2), 'trade.hailAnswered')).toHaveLength(1);
    const t = sim.world.get(ship, TraderC)!;
    expect(t.profile).toBe('trader.freighter');
    const before = { credits: sim.trade.credits, metal: stored(sim, 'item.metal'), theirs: t.credits, stock: t.stock.find((s) => s.item === 'item.metal')!.count };
    sim.enqueue({ type: 'trade.offer', ship, give: [], get: [{ item: 'item.metal', count: 12 }] });
    const ev = run(sim, 2);
    const offered = ofType(ev, 'trade.offered')[0]!;
    expect(offered.balance).toBeGreaterThan(0);
    sim.enqueue({ type: 'trade.accept', offer: offered.offer });
    const made = ofType(run(sim, 2), 'trade.dealMade')[0]!;
    expect(made.courier).toBe('them');
    // Escrow: the player's credits are held, the trader is not paid yet.
    expect(sim.trade.credits).toBe(before.credits - offered.balance);
    expect(t.credits).toBe(before.theirs);
    expect(t.stock.find((s) => s.item === 'item.metal')!.count).toBe(before.stock - 12);

    const events = run(sim, 4000);
    const docked = ofType(events, 'vehicle.docked');
    expect(docked).toHaveLength(1);
    expect(ofType(events, 'trade.delivered')).toEqual([{ type: 'trade.delivered', deal: made.deal, ship, to: 'player' }]);
    expect(ofType(events, 'trade.settled')[0]).toMatchObject({ deal: made.deal, credits: offered.balance });
    expect(ofType(events, 'item.hauled').some((e) => e.to === 'storage' && e.item === 'item.metal')).toBe(true);
    expect(stored(sim, 'item.metal')).toBe(before.metal + 12);
    expect(t.credits).toBe(before.theirs + offered.balance);
    // The courier flew home and vanished.
    expect(sim.world.query(VehicleC).filter((v) => sim.world.get(v, VehicleC)!.homeShip === ship)).toHaveLength(0);
  });

  it('sell to a mining ship: crew load the player shuttle at the unloaders, it flies over, swaps cargo and the player is paid', () => {
    const { sim, ship } = withCivilian('mining');
    const shuttle = crewPilot(sim);
    // Stock the starter with electronics to sell.
    const crate = sim.world.query(StorageC).find((i) => shipIdOf(sim, sim.world.get(i, ModuleC)) === shipIds(sim)[0] as number)!;
    storageAdd(sim, crate, 'item.electronics', 10);
    const have = stored(sim, 'item.electronics');
    sim.enqueue({ type: 'trade.hail', ship });
    run(sim, 2);
    const t = sim.world.get(ship, TraderC)!;
    const credits = sim.trade.credits;
    const theirs = t.credits;
    sim.enqueue({ type: 'trade.offer', ship, give: [{ item: 'item.electronics', count: 10 }], get: [] });
    const offered = ofType(run(sim, 2), 'trade.offered')[0]!;
    expect(offered.balance).toBeLessThan(0);
    sim.enqueue({ type: 'trade.accept', offer: offered.offer });
    const made = ofType(run(sim, 2), 'trade.dealMade')[0]!;
    expect(made.courier).toBe('you');
    const events = run(sim, 6000);
    expect(ofType(events, 'vehicle.docked').length).toBeGreaterThanOrEqual(1);
    expect(ofType(events, 'trade.delivered')[0]).toMatchObject({ to: 'trader' });
    expect(ofType(events, 'trade.settled')[0]).toMatchObject({ credits: offered.balance });
    expect(stored(sim, 'item.electronics')).toBe(have - 10);
    expect(sim.trade.credits).toBe(credits - offered.balance);
    expect(t.credits).toBe(theirs + offered.balance);
    expect(t.stock.find((s) => s.item === 'item.electronics')!.count).toBeGreaterThanOrEqual(10);
    // The shuttle is home again, empty.
    expect(sim.world.get(shuttle, VehicleC)!.cargo).toEqual([]);
    expect(storageCount(sim, crate, 'item.electronics')).toBeLessThanOrEqual(have);
    void CarryingC;
    // Save round trip after a finished deal.
    const loaded = deserialize(serialize(sim), content);
    expect(serialize(loaded)).toBe(serialize(sim));
  });

  it('a trade run with no crew aboard completes end to end', () => {
    const { sim, ship } = withCivilian('mining');
    const shuttle = sim.world.query(VehicleC)[0] as number;
    expect(sim.world.get(shuttle, VehicleC)!.pilot).toBe(0);
    const crate = sim.world.query(StorageC).find((i) => shipIdOf(sim, sim.world.get(i, ModuleC)) === shipIds(sim)[0] as number)!;
    storageAdd(sim, crate, 'item.electronics', 10);
    const have = stored(sim, 'item.electronics');
    sim.enqueue({ type: 'trade.hail', ship });
    run(sim, 2);
    const credits = sim.trade.credits;
    sim.enqueue({ type: 'trade.offer', ship, give: [{ item: 'item.electronics', count: 10 }], get: [{ item: 'item.ice', count: 5 }] });
    const offered = ofType(run(sim, 2), 'trade.offered')[0]!;
    sim.enqueue({ type: 'trade.accept', offer: offered.offer });
    expect(ofType(run(sim, 2), 'trade.dealMade')[0]).toMatchObject({ courier: 'you' });
    const events = run(sim, 8000);
    expect(ofType(events, 'trade.settled')).toHaveLength(1);
    expect(ofType(events, 'trade.failed')).toHaveLength(0);
    expect(stored(sim, 'item.electronics')).toBe(have - 10);
    expect(sim.trade.credits).toBe(credits - offered.balance);
    const v = sim.world.get(shuttle, VehicleC)!;
    expect(v.state).toBe('stowed');
    expect(v.autopilot).toBe(false);
    expect(v.pilot).toBe(0);
  });

  it('refuses a hold that is too small', () => {
    const { sim, ship } = withCivilian('mining');
    const crate = sim.world.query(StorageC).find((i) => shipIdOf(sim, sim.world.get(i, ModuleC)) === shipIds(sim)[0] as number)!;
    storageAdd(sim, crate, 'item.scrap', 90);
    sim.enqueue({ type: 'trade.hail', ship });
    run(sim, 2);
    const sell = (n: number): number => {
      sim.enqueue({ type: 'trade.offer', ship, give: [{ item: 'item.scrap', count: n }], get: [] });
      return ofType(run(sim, 2), 'trade.offered')[0]!.offer;
    };
    const reasons = (offer: number): string[] => {
      sim.enqueue({ type: 'trade.accept', offer });
      return ofType(run(sim, 2), 'command.rejected').map((e) => e.reason);
    };
    expect(reasons(sell(80))).toEqual(['tooBig']);
    expect(sim.trade.deals).toHaveLength(0);
    expect(sim.trade.credits).toBe(500);
  });

  it('calling off a deal before the shuttle leaves restores everything; one in transit cannot be recalled', () => {
    const { sim, ship } = withCivilian('mining');
    const shuttle = crewPilot(sim);
    const crate = sim.world.query(StorageC).find((i) => shipIdOf(sim, sim.world.get(i, ModuleC)) === shipIds(sim)[0] as number)!;
    storageAdd(sim, crate, 'item.electronics', 10);
    sim.enqueue({ type: 'trade.hail', ship });
    run(sim, 2);
    const t = sim.world.get(ship, TraderC)!;
    const wallet = t.credits;
    sim.enqueue({ type: 'trade.offer', ship, give: [{ item: 'item.electronics', count: 6 }], get: [] });
    const sale = ofType(run(sim, 2), 'trade.offered')[0]!;
    sim.enqueue({ type: 'trade.accept', offer: sale.offer });
    const made = ofType(run(sim, 2), 'trade.dealMade')[0]!;
    expect(t.credits).toBe(wallet + sale.balance); // their payment is held in escrow
    expect(sim.world.get(shuttle, VehicleC)!.outbound).toBe(true);
    sim.enqueue({ type: 'trade.cancel', id: made.deal });
    expect(ofType(run(sim, 2), 'trade.failed')[0]).toMatchObject({ deal: made.deal, reason: 'cancelled' });
    expect(t.credits).toBe(wallet);
    expect(sim.trade.credits).toBe(500);
    expect(sim.world.get(shuttle, VehicleC)!.outbound).toBe(false);
    // A purchase on the player's shuttle leaves at once: it cannot be recalled.
    run(sim, 400); // the shuttle finishes docking first
    const stock = t.stock.find((s) => s.item === 'item.ice')!.count;
    sim.enqueue({ type: 'trade.offer', ship, give: [], get: [{ item: 'item.ice', count: 10 }] });
    const buy = ofType(run(sim, 2), 'trade.offered')[0]!;
    sim.enqueue({ type: 'trade.accept', offer: buy.offer });
    const deal2 = ofType(run(sim, 2), 'trade.dealMade')[0]!;
    expect(deal2.courier).toBe('you'); // mining ships have no shuttle: the player's goes over
    expect(t.stock.find((s) => s.item === 'item.ice')!.count).toBe(stock - 10);
    run(sim, 100);
    sim.enqueue({ type: 'trade.cancel', id: deal2.deal });
    expect(ofType(run(sim, 2), 'command.rejected').map((e) => e.reason)).toEqual(['inTransit']);
  });

  it('a courier shot down in flight refunds the buyer and the goods are lost', () => {
    const { sim, ship } = withCivilian('freighter');
    sim.enqueue({ type: 'trade.hail', ship });
    run(sim, 2);
    const t = sim.world.get(ship, TraderC)!;
    sim.enqueue({ type: 'trade.offer', ship, give: [], get: [{ item: 'item.metal', count: 10 }] });
    const offer = ofType(run(sim, 2), 'trade.offered')[0]!;
    sim.enqueue({ type: 'trade.accept', offer: offer.offer });
    ofType(run(sim, 2), 'trade.dealMade');
    run(sim, 60);
    const courier = sim.world.query(VehicleC).find((v) => sim.world.get(v, VehicleC)!.homeShip === ship)!;
    expect(sim.world.get(courier, VehicleC)!.state).toBe('flying');
    destroyVehicle(sim, courier);
    const ev = run(sim, 3);
    expect(ofType(ev, 'trade.failed')[0]).toMatchObject({ reason: 'lost' });
    expect(sim.trade.credits).toBe(500);
    expect(t.credits).toBe(sim.world.get(ship, TraderC)!.credits);
    expect(sim.trade.deals.every((d) => d.held === 0)).toBe(true);
  });

  it('is deterministic: the same game and commands give the same bytes tick for tick', () => {
    const play = (): string => {
      const { sim, ship } = withCivilian('freighter');
      sim.enqueue({ type: 'trade.hail', ship });
      run(sim, 2);
      sim.enqueue({ type: 'trade.offer', ship, give: [], get: [{ item: 'item.metal', count: 6 }] });
      const o = ofType(run(sim, 2), 'trade.offered')[0]!;
      sim.enqueue({ type: 'trade.accept', offer: o.offer });
      run(sim, 600);
      return serialize(sim);
    };
    expect(play()).toBe(play());
  });
});
