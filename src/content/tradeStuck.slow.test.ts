import { describe, expect, it } from 'vitest';
import { ShipC, TraderC, deserialize, newGame, serialize } from '../sim';
import { cargoCount } from '../sim/vehicles/cargo';
import { VehicleC } from '../sim/vehicles/components';
import { isLive } from '../sim/trade/deals';
import { playerCrew } from '../sim/story/world';
import { content } from './index';
import { buying, metal, metalLike, order, run, runOut, until } from './tradeStuckFixture';

// Slow tier: the natural-length waits of the stuck-delivery tests (tradeStuck.test.ts starts the same cases a few seconds short of each deadline).
describe('a delivery that cannot finish, full waits', () => {
  it('return flight to a lost airlock is called off, settles escrow once, and travel is free again', () => {
    const { sim, start: before } = buying();
    const metal0 = metal(sim);
    until(sim, 'back');
    sim.trade.deals[0]!.airlock = 999_999; // the destination airlock is gone: the shuttle can never dock
    run(sim, 1500);
    const mid = deserialize(serialize(sim), content); // the blocked stage survives a save and load
    runOut(mid, 4000); // only the reloaded game runs on: the deadline is in the saved deal timer
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
    runOut(sim, 8000);
    const d = sim.trade.deals[0]!;
    expect(isLive(d), JSON.stringify(d)).toBe(false);
    expect(d.phase).toBe('done');
    const v = sim.world.get([...sim.world.query(VehicleC)][0]!, VehicleC)!;
    expect(cargoCount(v)).toBeGreaterThan(0); // not duplicated into storage, not refunded
    expect(sim.trade.credits).toBeLessThan(before); // the player paid
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
    runOut(reloaded, 3200);
    for (const s of [reloaded]) {
      expect(s.trade.deals[0]!.phase).toBe('done');
      // The player's side is exact (what they gave is gone, what they got is theirs, none duplicated). Credits between the two sides are conserved.
      expect(metalLike(s, giveItem)).toBe(before.give - 4);
      expect(metalLike(s, getItem)).toBe(before.get + 1);
      expect(s.trade.credits + s.world.get(st, TraderC)!.credits).toBe(before.credits);
    }
  });
});

describe("a stuck delivery by the trader's own shuttle, full waits", () => {
  it('before the exchange (still flying in): the deal fails, the player is refunded and the trader gets its goods back; survives a reload', () => {
    const { sim, ship, before, stock } = order();
    expect(sim.trade.deals[0]!.phase).toBe('back');
    sim.world.destroyEntity(sim.trade.deals[0]!.airlock); // the destination airlock is destroyed with the shuttle on its way
    run(sim, 2000);
    const reloaded = deserialize(serialize(sim), content);
    runOut(reloaded, 3000);
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
    runOut(reloaded, 3500);
    for (const s of [reloaded]) {
      expect(s.trade.deals[0]!.phase).toBe('failed');
      expect(s.trade.credits).toBe(before.credits);
      expect(s.world.get(ship, TraderC)!.credits).toBe(before.theirs);
      expect(stock(s)).toBe(before.stock);
      expect(metalLike(s, 'item.metal')).toBe(before.metal);
    }
  });
});
