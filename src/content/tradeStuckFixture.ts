import { expect } from 'vitest';
import { ShipC, TraderC, VehicleC, newGame, playerItems, type Sim } from '../sim';
import { isLive } from '../sim/trade/deals';
import { holding } from '../sim/trade/player';
import { content } from './index';

/** A started game with a hailed trading outpost, and a bought order of 10 metal accepted. */
export function buying(): { sim: Sim; station: number; start: number } {
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
export function metal(sim: Sim): number {
  const held = holding(sim, 'item.metal').reduce((n, s) => n + s.count, 0);
  return held + sim.world.query(VehicleC).reduce((n, id) => n + (sim.world.get(id, VehicleC)!.cargo.find((c) => c.item === 'item.metal')?.count ?? 0), 0);
}
export function until(sim: Sim, phase: string): void {
  for (let i = 0; i < 6000 && sim.trade.deals[0]?.phase !== phase; i++) sim.step();
  expect(sim.trade.deals[0]?.phase).toBe(phase);
}
export const run = (sim: Sim, ticks: number): void => { for (let i = 0; i < ticks; i++) sim.step(); };
/** Run until no deal is live (or `max` ticks pass: the failure case), then a settling tail so refunds, jobs and the like finish. */
export function runOut(sim: Sim, max: number, tail = 150): void {
  let i = 0;
  while (i < max && sim.trade.deals.some(isLive)) { sim.step(); i++; }
  run(sim, Math.min(tail, Math.max(0, max - i)));
}

/** Units of an item the player physically has: stores plus any shuttle hold. */
export function metalLike(sim: Sim, item: string): number {
  return playerItems(sim, item) + sim.world.query(VehicleC).reduce((n, id) => n + (sim.world.get(id, VehicleC)!.cargo.find((c) => c.item === item)?.count ?? 0), 0);
}

/** A started game with a generated freighter (it has its own shuttle) in the node. */
let freighterSeed = 1; // the first seed with a freighter is the same every time, so later calls skip the ones before it
export function withFreighter(): { sim: Sim; ship: number } {
  for (let seed = freighterSeed; seed < 80; seed++) {
    const sim = newGame(1, content);
    sim.galaxy.fleets = [];
    sim.enqueue({ type: 'debug.spawnGenerated', faction: 'faction.civilian', seed, depth: 2, cx: 130, cy: 70 });
    sim.step();
    sim.events.drain();
    const ship = sim.world.query(ShipC).find((i) => sim.world.get(i, ShipC)!.gen?.role === 'freighter');
    if (ship) { freighterSeed = seed; return { sim, ship }; }
  }
  throw new Error('no freighter found');
}

export function order() {
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

