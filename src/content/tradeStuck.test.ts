import { describe, expect, it } from 'vitest';
import { ShipC, deserialize, newGame, serialize, type Sim } from '../sim';
import { cargoCount } from '../sim/vehicles/cargo';
import { VehicleC } from '../sim/vehicles/components';
import { isLive } from '../sim/trade/deals';
import { playerCrew } from '../sim/story/world';
import { storagesHolding } from '../sim/trade/player';
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
  const held = storagesHolding(sim, 'item.metal').reduce((n, s) => n + s.count, 0);
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
    run(sim, 6000);
    run(mid, 4500);
    for (const s of [sim, mid]) {
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
});
