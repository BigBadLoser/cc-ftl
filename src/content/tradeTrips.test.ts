import { describe, expect, it } from 'vitest';
import { ShipC, TraderC, newGame, unitPrice, type ItemQty, type Sim } from '../sim';
import { MAX_TRIPS, peakFunding, planTrips } from '../sim/trade/trips';
import type { Trip } from '../sim/trade/types';
import { content } from './index';

const HOLD = content.vehicles['vehicle.shuttle'].cargo;

/** A started game with a hailed trading outpost next to the player. */
function station(): { sim: Sim; ship: number } {
  const sim = newGame(1, content);
  sim.enqueue({ type: 'debug.spawnStation', kind: 'station.trading', size: 'outpost', seed: 4 });
  sim.step();
  const ship = sim.world.query(ShipC).find((i) => sim.world.get(i, ShipC)!.immobile)!;
  sim.enqueue({ type: 'trade.hail', ship });
  sim.step();
  expect(sim.world.get(ship, TraderC)).toBeDefined();
  return { sim, ship };
}

const units = (lines: ItemQty[]): number => lines.reduce((n, l) => n + l.count, 0);
const total = (lines: ItemQty[], f: (l: ItemQty) => number): number => lines.reduce((n, l) => n + l.count * f(l), 0);

describe('barter trips', () => {
  // Fixed orders, cheap goods on one side and dear on the other, in both id orders: the early trips must never take the trader's goods
  // ahead of the player's.
  const orders: [string, ItemQty[], ItemQty[]][] = [
    ['cheap then dear to give', [{ item: 'item.ice', count: 70 }, { item: 'item.polymer', count: 10 }], [{ item: 'item.metal', count: 60 }]],
    ['dear then cheap to give', [{ item: 'item.electronics', count: 10 }, { item: 'item.ice', count: 70 }], [{ item: 'item.metal', count: 80 }]],
    ['many small gets', [{ item: 'item.polymer', count: 30 }], [{ item: 'item.ice', count: 40 }, { item: 'item.metal', count: 60 }]],
    ['many cheap units for a few dear ones', [{ item: 'item.ice', count: 80 }], [{ item: 'item.metal', count: 80 }]],
    ['one dear unit for many cheap', [{ item: 'item.electronics', count: 12 }], [{ item: 'item.ice', count: 100 }]],
  ];
  for (const [name, give, get] of orders) {
    it(`${name}: stopping after any trip leaves the player no further ahead than they have handed over`, () => {
      const { sim, ship } = station();
      // Only balanced barters are allowed: trim the get side until the trader's goods are worth no more than the player's.
      const buy = (l: ItemQty): number => unitPrice(sim, ship, l.item, 'buy')!;
      const sell = (l: ItemQty): number => unitPrice(sim, ship, l.item, 'sell')!;
      const g = give.map((l) => ({ ...l }));
      const r = get.map((l) => ({ ...l }));
      while (total(r, sell) > total(g, buy)) (r.filter((l) => l.count > 0).at(-1) as ItemQty).count--;
      const trips = planTrips(sim, ship, g, r.filter((l) => l.count > 0), HOLD, true) as Trip[];
      expect(Array.isArray(trips)).toBe(true);
      let given = 0;
      let got = 0;
      let gu = 0;
      let ru = 0;
      for (const t of trips) {
        expect(units(t.give)).toBeLessThanOrEqual(HOLD);
        expect(units(t.get)).toBeLessThanOrEqual(HOLD);
        given += total(t.give, buy);
        got += total(t.get, sell);
        gu += units(t.give);
        ru += units(t.get);
        expect(got).toBeLessThanOrEqual(given); // the player is never ahead at a settled point
      }
      if (name.startsWith('many cheap units')) expect(trips.length).toBeGreaterThan(1); // the case where cutting both sides by units would put the player ahead
      expect(gu).toBe(units(g));
      expect(ru).toBe(units(r));
    });
  }

  it('refuses a barter the player does not cover', () => {
    const { sim, ship } = station();
    expect(planTrips(sim, ship, [{ item: 'item.ice', count: 1 }], [{ item: 'item.electronics', count: 50 }], HOLD, true)).toBeNull();
  });

  it('refuses an order of more than the most trips', () => {
    const { sim, ship } = station();
    expect(planTrips(sim, ship, [], [{ item: 'item.metal', count: HOLD * MAX_TRIPS + 1 }], HOLD)).toBe('tooBig');
    expect(planTrips(sim, ship, [{ item: 'item.electronics', count: HOLD * MAX_TRIPS + 1 }], [], HOLD, true)).toBe('tooBig');
  });
});

describe('peak funding', () => {
  const trip = (balance: number): Trip => ({ give: [], get: [], balance });
  it('is the highest running total each side pays out, not the order balance', () => {
    expect(peakFunding([trip(100), trip(-100)], false)).toEqual({ player: 100, trader: 0 });
    expect(peakFunding([trip(-100), trip(100)], false)).toEqual({ player: 0, trader: 100 });
    expect(peakFunding([trip(50), trip(50), trip(-30)], false)).toEqual({ player: 100, trader: 0 });
  });
  it('is nothing for a barter', () => {
    expect(peakFunding([trip(100), trip(-40)], true)).toEqual({ player: 0, trader: 0 });
  });
});
