import { describe, expect, it } from 'vitest';
import { JobC, ModuleC, ShipC, StorageC, TraderC, deserialize, unitPrice, newGame, playerItems, serialize, storageAdd, type Sim } from '../sim';
import { cargoCount, cargoTake } from '../sim/vehicles/cargo';
import { VehicleC } from '../sim/vehicles/components';
import { isLive } from '../sim/trade/deals';
import { playerCrew } from '../sim/story/world';
import { holding } from '../sim/trade/player';
import { shipIdOf, shipIds } from '../sim/regions';
import { content } from './index';

/** A started game with a hailed trading outpost, and a bought order of 10 metal accepted. */
function buying(): { sim: Sim; station: number; start: number } {
  const sim = newGame(1, content);
  const start = sim.trade.credits;
  sim.enqueue({ type: 'debug.spawnStation', kind: 'station.trading', size: 'outpost', seed: 4 });
  sim.step();
  const station = sim.world.query(ShipC).find((i) => sim.world.get(i, ShipC)!.immobile)!;
  sim.enqueue({ type: 'trade.hail', ship: station });
  sim.step();
  sim.enqueue({ type: 'trade.offer', ship: station, give: [], get: [{ item: 'item.metal', count: 10 }] });
  sim.step();
  sim.enqueue({ type: 'trade.accept', offer: sim.trade.offers[0]!.id });
  sim.step();
  return { sim, station, start };
}
/** Metal the player physically has: in the stores plus anything in a shuttle's hold. */
function metal(sim: Sim): number {
  const held = holding(sim, 'item.metal').reduce((n, s) => n + s.count, 0);
  return held + sim.world.query(VehicleC).reduce((n, id) => n + (sim.world.get(id, VehicleC)!.cargo.find((c) => c.item === 'item.metal')?.count ?? 0), 0);
}
function until(sim: Sim, phase: string): void {
  for (let i = 0; i < 6000 && sim.trade.deals[0]?.phase !== phase; i++) sim.step();
  expect(sim.trade.deals[0]?.phase).toBe(phase);
}
const run = (sim: Sim, ticks: number): void => { for (let i = 0; i < ticks; i++) sim.step(); };

describe('a delivery that cannot finish', () => {
  it('return flight to a lost airlock is called off, settles escrow once, and travel is free again', () => {
    const { sim, start: before } = buying();
    const metal0 = metal(sim);
    until(sim, 'back');
    sim.trade.deals[0]!.airlock = 999_999; // the destination airlock is gone: the shuttle can never dock
    run(sim, 1500);
    const mid = deserialize(serialize(sim), content); // the blocked stage survives a save and load
    run(mid, 4000); // only the reloaded game runs on: the deadline is in the saved deal timer
    for (const s of [mid]) {
      const d = s.trade.deals[0]!;
      expect(isLive(d), `${s === sim ? 'live' : 'live after reload'} ${JSON.stringify(d)}`).toBe(false);
      expect(s.trade.deals.some(isLive)).toBe(false);
      expect(d.held).toBe(0);
      // The goods are either physically with the player (and paid for) or back with the trader (and refunded): never both, never neither.
      const paid = s.trade.credits < before;
      expect(metal(s) - metal0, `credits ${s.trade.credits} of ${before}`).toBe(paid ? 10 : 0);
    }
  });

  it('a hold nobody unloads is given up on: the deal settles with the goods left aboard', () => {
    const { sim, start: before } = buying();
    until(sim, 'unload');
    for (const id of playerCrew(sim)) sim.world.destroyEntity(id); // nobody left to haul
    run(sim, 8000);
    const d = sim.trade.deals[0]!;
    expect(isLive(d), JSON.stringify(d)).toBe(false);
    expect(d.phase).toBe('done');
    const v = sim.world.get([...sim.world.query(VehicleC)][0]!, VehicleC)!;
    expect(cargoCount(v)).toBeGreaterThan(0); // not duplicated into storage, not refunded
    expect(sim.trade.credits).toBeLessThan(before); // the player paid
  });

  it('a lost return shuttle already fails the deal', () => {
    const { sim } = buying();
    until(sim, 'back');
    sim.world.destroyEntity(sim.trade.deals[0]!.vehicle);
    run(sim, 5);
    expect(sim.trade.deals[0]!.phase).toBe('failed');
  });

  it('a mixed deal (give and get) timing out after the exchange keeps every good and credit where it went', () => {
    const sim = newGame(1, content);
    sim.enqueue({ type: 'debug.spawnStation', kind: 'station.trading', size: 'outpost', seed: 4 });
    sim.step();
    const st = sim.world.query(ShipC).find((i) => sim.world.get(i, ShipC)!.immobile)!;
    sim.enqueue({ type: 'trade.hail', ship: st });
    sim.step();
    const giveItem = 'item.electronics';
    const getItem = 'item.polymer';
        const before = { give: metalLike(sim, giveItem), get: metalLike(sim, getItem), credits: sim.trade.credits + sim.world.get(st, TraderC)!.credits };
    sim.enqueue({ type: 'trade.offer', ship: st, give: [{ item: giveItem, count: 4 }], get: [{ item: getItem, count: 1 }], barter: true });
    sim.step();
    expect(sim.trade.offers).toHaveLength(1);
    sim.enqueue({ type: 'trade.accept', offer: sim.trade.offers[0]!.id });
    sim.step();
    until(sim, 'back'); // the exchange at the station is behind it
    expect(sim.trade.deals[0]!.courier).toBe('you');
    sim.trade.deals[0]!.airlock = 999_999;
    run(sim, 2000);
    const reloaded = deserialize(serialize(sim), content); // save/load in the middle of the blocked stage
    run(reloaded, 3200);
    for (const s of [reloaded]) {
      expect(s.trade.deals[0]!.phase).toBe('done');
      // The player's side is exact (what they gave is gone, what they got is theirs, none duplicated). Credits between the two sides are conserved.
      expect(metalLike(s, giveItem)).toBe(before.give - 4);
      expect(metalLike(s, getItem)).toBe(before.get + 1);
      expect(s.trade.credits + s.world.get(st, TraderC)!.credits).toBe(before.credits);
    }
  });
});

/** Units of an item the player physically has: stores plus any shuttle hold. */
function metalLike(sim: Sim, item: string): number {
  return playerItems(sim, item) + sim.world.query(VehicleC).reduce((n, id) => n + (sim.world.get(id, VehicleC)!.cargo.find((c) => c.item === item)?.count ?? 0), 0);
}

/** A started game with a generated freighter (it has its own shuttle) in the node. */
function withFreighter(): { sim: Sim; ship: number } {
  for (let seed = 1; seed < 80; seed++) {
    const sim = newGame(1, content);
    sim.galaxy.fleets = [];
    sim.enqueue({ type: 'debug.spawnGenerated', faction: 'faction.civilian', seed, depth: 2, cx: 130, cy: 70 });
    sim.step();
    sim.events.drain();
    const ship = sim.world.query(ShipC).find((i) => sim.world.get(i, ShipC)!.gen?.role === 'freighter');
    if (ship) return { sim, ship };
  }
  throw new Error('no freighter found');
}

describe("a stuck delivery by the trader's own shuttle", () => {
  function order() {
    const { sim, ship } = withFreighter();
    sim.enqueue({ type: 'trade.hail', ship });
    run(sim, 2);
    const t = sim.world.get(ship, TraderC)!;
    const stock = (s: Sim): number => s.world.get(ship, TraderC)!.stock.find((q) => q.item === 'item.metal')?.count ?? 0;
    const before = { credits: sim.trade.credits, theirs: t.credits, stock: stock(sim), metal: metalLike(sim, 'item.metal') };
    sim.enqueue({ type: 'trade.offer', ship, give: [], get: [{ item: 'item.metal', count: 12 }] });
    run(sim, 2);
    sim.enqueue({ type: 'trade.accept', offer: sim.trade.offers[0]!.id });
    run(sim, 2);
    expect(sim.trade.deals[0]!.courier).toBe('them');
    return { sim, ship, before, stock };
  }

  it('before the exchange (still flying in): the deal fails, the player is refunded and the trader gets its goods back; survives a reload', () => {
    const { sim, ship, before, stock } = order();
    expect(sim.trade.deals[0]!.phase).toBe('back');
    sim.world.destroyEntity(sim.trade.deals[0]!.airlock); // the destination airlock is destroyed with the shuttle on its way
    run(sim, 2000);
    const reloaded = deserialize(serialize(sim), content);
    run(reloaded, 3000);
    for (const s of [reloaded]) {
      expect(s.trade.deals[0]!.phase).toBe('failed');
      expect(s.trade.credits).toBe(before.credits);
      expect(s.world.get(ship, TraderC)!.credits).toBe(before.theirs);
      expect(stock(s)).toBe(before.stock);
      expect(metalLike(s, 'item.metal')).toBe(before.metal);
      expect(s.trade.deals.some(isLive)).toBe(false);
    }
  });

  it('docked but never unloaded: the deal fails and refunds, the shuttle leaves with its cargo back to the trader', () => {
    const { sim, ship, before, stock } = order();
    until(sim, 'unload');
    for (const id of playerCrew(sim)) sim.world.destroyEntity(id);
    run(sim, 3000);
    const reloaded = deserialize(serialize(sim), content);
    run(reloaded, 3500);
    for (const s of [reloaded]) {
      expect(s.trade.deals[0]!.phase).toBe('failed');
      expect(s.trade.credits).toBe(before.credits);
      expect(s.world.get(ship, TraderC)!.credits).toBe(before.theirs);
      expect(stock(s)).toBe(before.stock);
      expect(metalLike(s, 'item.metal')).toBe(before.metal);
    }
  });

  /** Move `n` metal from the docked trader shuttle's hold into the player's store, as the crew do one stack at a time. */
  function unloadSome(sim: Sim, vehicle: number, n: number): void {
    const crate = sim.world.query(StorageC).find((i) => shipIdOf(sim, sim.world.get(i, ModuleC)) === shipIds(sim)[0])!;
    storageAdd(sim, crate, 'item.metal', cargoTake(sim, vehicle, 'item.metal', n));
  }

  it('a partly unloaded delivery settles what arrived, refunds the rest and returns only the rest to the trader; survives a reload', () => {
    const { sim, ship, before, stock } = order();
    until(sim, 'unload');
    for (const id of playerCrew(sim)) sim.world.destroyEntity(id); // hauling stops
    const d = sim.trade.deals[0]!;
    const held = d.held;
    unloadSome(sim, d.vehicle, 5);
    run(sim, 3000);
    const reloaded = deserialize(serialize(sim), content);
    run(reloaded, 3500);
    const s = reloaded;
    expect(s.trade.deals[0]!.phase).toBe('done');
    const paid = s.world.get(ship, TraderC)!.credits - before.theirs;
    expect(paid).toBeGreaterThan(0);
    expect(paid).toBeLessThan(held); // 5 of 12, not all and not nothing
    expect(paid).toBe(Math.round((held * 5) / 12));
    expect(s.trade.credits).toBe(before.credits - paid); // the player pays only for what arrived
    expect(metalLike(s, 'item.metal')).toBe(before.metal + 5);
    expect(stock(s)).toBe(before.stock - 5); // the undelivered 7 went back to the trader, the 5 delivered did not
    expect(metalLike(s, 'item.metal') + stock(s)).toBe(before.metal + before.stock); // nothing duplicated, nothing lost
  });

  it('a fully unloaded delivery settles in full', () => {
    const { sim, ship, before, stock } = order();
    until(sim, 'unload');
    for (const id of playerCrew(sim)) sim.world.destroyEntity(id);
    const d = sim.trade.deals[0]!;
    const held = d.held;
    unloadSome(sim, d.vehicle, 12);
    run(sim, 5);
    expect(sim.trade.deals[0]!.phase).toBe('done');
    expect(sim.world.get(ship, TraderC)!.credits).toBe(before.theirs + held);
    expect(sim.trade.credits).toBe(before.credits - held);
    expect(metalLike(sim, 'item.metal')).toBe(before.metal + 12);
    expect(stock(sim)).toBe(before.stock - 12);
  });

  it('a timeout with zero picked up and an unload haul already reserved: the haul is cancelled with the cargo, nothing is taken after the refund; survives a reload', () => {
    // A first run finds the tick a crew member takes the first stack off the shuttle; the second stops one tick before it, with that
    // pickup haul reserved, and times the deal out there.
    const probe = order();
    until(probe.sim, 'unload');
    const hold = (s: Sim): number => cargoCount(s.world.get(s.trade.deals[0]!.vehicle, VehicleC)!);
    let pickupTick = 0;
    for (let i = 0; i < 3000 && !pickupTick; i++) {
      probe.sim.step();
      if (hold(probe.sim) < 12) pickupTick = probe.sim.tick;
    }
    expect(pickupTick).toBeGreaterThan(0);
    const { sim, ship, before, stock } = order();
    until(sim, 'unload');
    while (sim.tick < pickupTick - 1) sim.step();
    expect(sim.world.query(JobC).some((id) => { const j = sim.world.get(id, JobC)!; return j.haul?.phase === 'pickup' && j.haul.src.kind === 'vehicle' && j.reservedBy > 0; })).toBe(true);
    const d = sim.trade.deals[0]!;
    expect(cargoCount(sim.world.get(d.vehicle, VehicleC)!)).toBe(12); // nothing picked up yet
    d.timer = 300 * 20; // the next tick's deal step gives up, before the crew's work step
    sim.step();
    expect(d.phase).toBe('failed');
    const reloaded = deserialize(serialize(sim), content);
    run(reloaded, 200);
    for (const s of [sim, reloaded]) {
      if (s === sim) run(sim, 200);
      expect(s.trade.credits).toBe(before.credits);
      expect(s.world.get(ship, TraderC)!.credits).toBe(before.theirs);
      expect(stock(s)).toBe(before.stock); // restored once
      expect(metalLike(s, 'item.metal')).toBe(before.metal); // the player gained nothing
      expect(s.world.query(JobC).some((id) => s.world.get(id, JobC)!.haul?.src.kind === 'vehicle')).toBe(false);
    }
  });

  it('a part-delivered two-item order is charged the agreed value of exactly what arrived; survives a reload', () => {
    const { sim, ship } = withFreighter();
    sim.enqueue({ type: 'trade.hail', ship });
    run(sim, 2);
    // Two goods the trader holds in quantity, whose prices differ and move with its stock.
    const base = (i: string): number => (content.items as unknown as Record<string, { price: number }>)[i]?.price ?? 0;
    const items = sim.world.get(ship, TraderC)!.stock.filter((q) => q.count >= 8).map((q) => q.item)
      .sort((x, y) => base(y) - base(x)).slice(0, 2);
    expect(items).toHaveLength(2);
    const [a, b] = items.sort() as [string, string];
    const t0 = sim.world.get(ship, TraderC)!;
    // A tracked market: a is scarce against its baseline (dear), b sits at it, so taking the order moves the two prices differently.
    t0.base = [{ item: a, count: (t0.stock.find((q) => q.item === a)?.count ?? 0) + 40 }, { item: b, count: (t0.stock.find((q) => q.item === b)?.count ?? 0) + 2 }];
    const agreed = (item: string): number => unitPrice(sim, ship, item, 'sell')!;
    const pa = agreed(a);
    const pb = agreed(b);
    const credits = sim.trade.credits;
    const theirs = sim.world.get(ship, TraderC)!.credits;
    sim.enqueue({ type: 'trade.offer', ship, give: [], get: [{ item: a, count: 8 }, { item: b, count: 8 }] });
    run(sim, 2);
    const balance = sim.trade.offers[0]!.balance;
    expect(balance).toBe(pa * 8 + pb * 8);
    sim.enqueue({ type: 'trade.accept', offer: sim.trade.offers[0]!.id });
    run(sim, 2);
    until(sim, 'unload');
    for (const id of playerCrew(sim)) sim.world.destroyEntity(id);
    const d = sim.trade.deals[0]!;
    const crate = sim.world.query(StorageC).find((i) => shipIdOf(sim, sim.world.get(i, ModuleC)) === shipIds(sim)[0])!;
    storageAdd(sim, crate, a, cargoTake(sim, d.vehicle, a, 8)); // all of a and 3 of b arrived
    storageAdd(sim, crate, b, cargoTake(sim, d.vehicle, b, 3));
    run(sim, 3000);
    const reloaded = deserialize(serialize(sim), content);
    run(reloaded, 3500);
    const s = reloaded;
    expect(s.trade.deals[0]!.phase).toBe('done');
    expect(pa).toBeGreaterThan(20); // dear enough that stock moves the rounded price
    const charge = pa * 8 + pb * 3;
    expect(s.world.get(ship, TraderC)!.credits - theirs).toBe(charge);
    expect(credits - s.trade.credits).toBe(charge);
    expect(s.trade.credits + s.world.get(ship, TraderC)!.credits).toBe(credits + theirs);
  });
});
