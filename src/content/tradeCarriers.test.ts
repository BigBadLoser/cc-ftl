import { describe, expect, it } from 'vitest';
import { ModuleC, ShipC, StorageC, storageTake, TraderC, VehicleC, newGame, playerItems, playerShip, planCourier, yardService, type Sim } from '../sim';
import { VehicleBayC } from '../sim/vehicles/components';
import { shipIdOf } from '../sim/regions';
import { giveItems } from '../sim/story/effects';
import { playerCrew } from '../sim/story/world';
import { stowOrDrop } from '../sim/items/deck';
import { cargoAdd, cargoOf, cargoTake } from '../sim/vehicles/cargo';
import { endInspection, startInspection, liveInspection } from '../sim/inspect/start';
import { content } from './index';
import { outline, planHull, run as runYard, yardGame } from './yardFixture';

/**
 * One deal flow for every carrier (#548): the player's free shuttle first, else the trader's real one (a station's, in its hangar or on its pad).
 * Nothing is made up for a run: the vehicles in the world are the same before and after.
 */

const run = (sim: Sim, ticks: number, until?: () => boolean): void => {
  for (let i = 0; i < ticks && !until?.(); i++) sim.step();
};

/** A started game with a trading station (`station`: a hangar; `surface`: an asteroid base whose shuttle stands on a pad), hailed. */
function game(where: 'station' | 'surface', ownShuttle: boolean): { sim: Sim; ship: number; vehicles: Set<number> } {
  const sim = newGame(1, content);
  sim.enqueue(where === 'station'
    ? { type: 'debug.spawnStation', kind: 'station.trading', size: 'outpost', seed: 4 }
    : { type: 'debug.spawnOutpost', style: 'surface', kind: 'trading', seed: 3 });
  sim.step();
  const me = playerShip(sim);
  const ship = sim.world.query(ShipC).find((i) => i !== me && sim.world.get(i, ShipC)!.immobile)!;
  if (!ownShuttle) for (const id of [...sim.world.query(VehicleC)]) if (sim.world.get(id, VehicleC)!.homeShip === me) sim.world.destroyEntity(id);
  sim.enqueue({ type: 'trade.hail', ship });
  run(sim, 2);
  sim.events.drain();
  return { sim, ship, vehicles: new Set(sim.world.query(VehicleC)) };
}

/** Offer and accept a deal; returns it. */
function deal(sim: Sim, ship: number, give: { item: string; count: number }[], get: { item: string; count: number }[]) {
  sim.enqueue({ type: 'trade.offer', ship, give, get });
  run(sim, 1);
  expect(sim.trade.offers).toHaveLength(1);
  sim.enqueue({ type: 'trade.accept', offer: sim.trade.offers[0]!.id });
  run(sim, 1);
  return sim.trade.deals[sim.trade.deals.length - 1]!;
}

/** The phases a deal goes through, in order, until it ends. */
function phases(sim: Sim, max = 12000): string[] {
  const seen: string[] = [];
  for (let i = 0; i < max && sim.trade.deals.some((d) => d.phase !== 'done' && d.phase !== 'failed'); i++) {
    sim.step();
    for (const e of sim.events.drain()) if (e.type === 'trade.phase') seen.push(e.to);
  }
  return seen;
}

/** Take `n` electronics out of the player's storage (they went into the shuttle's hold). */
function takeFromPlayer(sim: Sim, n: number): void {
  let left = n;
  for (const id of sim.world.query(StorageC, ModuleC)) {
    if (left <= 0) break;
    if (shipIdOf(sim, sim.world.get(id, ModuleC)!) === playerShip(sim)) left -= storageTake(sim, id, 'item.electronics', left);
  }
}

const stockOf = (sim: Sim, ship: number, item: string): number => sim.world.get(ship, TraderC)!.stock.find((q) => q.item === item)?.count ?? 0;

describe('who carries a deal (#548)', () => {
  it("the player's free shuttle goes first", () => {
    const { sim, ship } = game('station', true);
    expect(planCourier(sim, ship)).toMatchObject({ courier: 'you' });
  });

  it("with none of the player's, the station's own real shuttle carries a purchase: staged, loaded, flown, unloaded, home, settled exactly", () => {
    const { sim, ship, vehicles } = game('station', false);
    const start = { credits: sim.trade.credits, theirs: sim.world.get(ship, TraderC)!.credits, metal: playerItems(sim, 'item.metal'), stock: stockOf(sim, ship, 'item.metal') };
    const d = deal(sim, ship, [], [{ item: 'item.metal', count: 10 }]);
    expect(d.courier).toBe('them');
    const v = d.vehicle;
    expect(sim.world.get(v, VehicleC)).toMatchObject({ homeShip: ship, state: 'stowed' });
    const price = d.held;
    expect(phases(sim)).toEqual(['dispatch', 'load', 'out', 'stationWork', 'back', 'done']);
    expect(sim.trade.credits).toBe(start.credits - price);
    expect(sim.world.get(ship, TraderC)!.credits).toBe(start.theirs + price);
    expect(playerItems(sim, 'item.metal')).toBe(start.metal + 10);
    expect(stockOf(sim, ship, 'item.metal')).toBe(start.stock - 10);
    run(sim, 2); // the deal lets the shuttle go the tick after it ends
    expect(sim.world.get(v, VehicleC)).toMatchObject({ state: 'stowed', cargo: [], autopilot: false });
    expect(sim.world.get(v, VehicleC)!.outbound).toBeFalsy();
    expect(new Set(sim.world.query(VehicleC))).toEqual(vehicles); // nothing made up, nothing lost
  });

  it("selling works through the station's shuttle when the player has none: loaded at the player's airlock, carried in at the station", () => {
    const { sim, ship, vehicles } = game('station', false);
    giveItems(sim, 'item.electronics', 6);
    run(sim, 2);
    const start = { credits: sim.trade.credits, theirs: sim.world.get(ship, TraderC)!.credits, have: playerItems(sim, 'item.electronics'), stock: stockOf(sim, ship, 'item.electronics') };
    const d = deal(sim, ship, [{ item: 'item.electronics', count: 6 }], []);
    expect(d.courier).toBe('them');
    const paid = d.held;
    expect(paid).toBeGreaterThan(0);
    expect(phases(sim)).toEqual(['dispatch', 'out', 'stationWork', 'back', 'unload', 'done']);
    expect(sim.trade.credits).toBe(start.credits + paid);
    expect(sim.world.get(ship, TraderC)!.credits).toBe(start.theirs - paid);
    expect(playerItems(sim, 'item.electronics')).toBe(start.have - 6);
    expect(stockOf(sim, ship, 'item.electronics')).toBe(start.stock + 6);
    expect(sim.world.get(d.vehicle || [...vehicles].find((id) => sim.world.get(id, VehicleC)?.homeShip === ship)!, VehicleC)).toMatchObject({ state: 'stowed', cargo: [] });
    expect(new Set(sim.world.query(VehicleC))).toEqual(vehicles);
  });

  it('a sale cut short at the airlock settles only what was handed over: the player keeps the rest, unpaid, and is charged nothing', () => {
    const { sim, ship } = game('station', false);
    giveItems(sim, 'item.electronics', 6);
    run(sim, 2);
    const start = { credits: sim.trade.credits, theirs: sim.world.get(ship, TraderC)!.credits, have: playerItems(sim, 'item.electronics'), stock: stockOf(sim, ship, 'item.electronics') };
    const d = deal(sim, ship, [{ item: 'item.electronics', count: 6 }], []);
    const held = d.held;
    run(sim, 12000, () => d.phase === 'stationWork' && !!sim.world.get(d.vehicle, VehicleC)!.outbound);
    for (const id of playerCrew(sim)) sim.world.destroyEntity(id); // nobody left to finish loading
    // Exactly 2 of the 6 made it aboard; the rest is back in the player's storage.
    const aboard = cargoTake(sim, d.vehicle, 'item.electronics', cargoOf(sim, d.vehicle, 'item.electronics'));
    stowOrDrop(sim, playerShip(sim), 'item.electronics', aboard);
    const two = Math.min(2, playerItems(sim, 'item.electronics'));
    expect(two).toBe(2);
    expect(cargoAdd(sim, d.vehicle, 'item.electronics', 2)).toBe(2);
    takeFromPlayer(sim, 2);
    d.timer = 300 * 20 - 5; // just short of the far-side deadline
    phases(sim);
    expect(d.phase).toBe('done');
    const paid = held - Math.round((held * 4) / 6);
    expect(sim.trade.credits - start.credits).toBe(paid);
    expect(start.theirs - sim.world.get(ship, TraderC)!.credits).toBe(paid);
    expect(playerItems(sim, 'item.electronics')).toBe(start.have - 2);
    expect(stockOf(sim, ship, 'item.electronics')).toBe(start.stock + 2);
  });

  it("an asteroid base's shuttle on its pad: station crew walk out suited to load it, it flies over and back to its pad", () => {
    const { sim, ship, vehicles } = game('surface', false);
    const pad = [...sim.world.query(VehicleBayC)].find((id) => sim.content.modules[sim.world.get(id, ModuleC)!.def]?.vehicleBay?.pad && sim.world.get(id, VehicleBayC)!.vehicle)!;
    expect(pad).toBeDefined();
    const item = sim.world.get(ship, TraderC)!.stock.find((q) => q.count >= 4)!.item;
    const have = playerItems(sim, item);
    const d = deal(sim, ship, [], [{ item, count: 4 }]);
    expect(d.courier).toBe('them');
    expect(sim.world.get(d.vehicle, VehicleC)!.home).toBe(pad);
    const v = d.vehicle;
    expect(phases(sim)).toEqual(['dispatch', 'load', 'out', 'stationWork', 'back', 'done']);
    expect(playerItems(sim, item)).toBe(have + 4);
    expect(sim.world.get(v, VehicleC)).toMatchObject({ state: 'stowed', home: pad });
    expect(new Set(sim.world.query(VehicleC))).toEqual(vehicles);
  });

  it("inspectors come over in the station's own shuttle, which goes home and stays the station's", () => {
    const { sim, ship, vehicles } = game('station', true);
    expect(startInspection(sim, ship, 'navy', 'Inspector')).toBe(true);
    const [vehicle] = liveInspection(sim)!;
    expect(vehicles.has(vehicle)).toBe(true);
    expect(sim.world.get(vehicle, VehicleC)!.homeShip).toBe(ship);
    run(sim, 20000, () => !liveInspection(sim));
    expect(liveInspection(sim)).toBeUndefined();
    run(sim, 3000, () => sim.world.get(vehicle, VehicleC)?.state === 'stowed');
    expect(sim.world.get(vehicle, VehicleC)).toMatchObject({ homeShip: ship, state: 'stowed', cargo: [] });
    expect(new Set(sim.world.query(VehicleC))).toEqual(vehicles);
  });

  it('an inspection ended in mid-flight: its people leave the world and the shuttle flies home empty', () => {
    const { sim, ship } = game('station', true);
    expect(startInspection(sim, ship, 'navy', 'Inspector')).toBe(true);
    const [vehicle] = liveInspection(sim)!;
    run(sim, 3000, () => sim.world.get(vehicle, VehicleC)?.state === 'flying');
    expect(sim.world.get(vehicle, VehicleC)!.state).toBe('flying');
    endInspection(sim, vehicle);
    expect(sim.world.get(vehicle, VehicleC)).toMatchObject({ pilot: 0, passengers: [] });
    run(sim, 3000, () => sim.world.get(vehicle, VehicleC)?.state === 'stowed');
    expect(sim.world.get(vehicle, VehicleC)!.state).toBe('stowed');
  });

  it("the yard's contractors come in the station's own shuttle", () => {
    const { sim, station, me } = yardGame();
    const vehicles = new Set(sim.world.query(VehicleC));
    expect(yardService(sim, station)).toBeTruthy();
    planHull(sim, me, outline(sim, me, 8, -2, 4, 3));
    sim.enqueue({ type: 'yard.order', station });
    runYard(sim, 5);
    const order = sim.yard.orders[0]!;
    expect(order.vehicle).toBeGreaterThan(0);
    expect(vehicles.has(order.vehicle)).toBe(true);
    expect(sim.world.get(order.vehicle, VehicleC)!.homeShip).toBe(station);
    const vehicle = order.vehicle;
    runYard(sim, 30000, () => order.phase === 'done' || order.phase === 'failed');
    expect(order.phase).toBe('done');
    runYard(sim, 3000, () => sim.world.get(vehicle, VehicleC)?.state === 'stowed');
    expect(sim.world.get(vehicle, VehicleC)).toMatchObject({ homeShip: station, state: 'stowed' });
    expect(new Set(sim.world.query(VehicleC))).toEqual(vehicles);
  });
});
