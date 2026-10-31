import { describe, expect, it } from 'vitest';
import {
  AsteroidC, TraderC, homeShip, newGame, placementError, shipGrid, spawnModule, spawnVehicle, totalStock, unitPrice, type Sim,
} from '../sim';
import { DELIVERY_BASE, DELIVERY_HOPS, DELIVERY_PER_DANGER, DELIVERY_PER_HOP } from '../sim/galaxy/tuningJobs';
import { ROUTE_CHARGE, TURN_TICKS } from '../sim/galaxy/tuning';
import { TICK_HZ } from '../sim/time';
import { content } from './index';

/**
 * Balance harness (issue #222): credits per game minute of a delivery loop against a built mine -> refine -> sell setup, so economy tuning is
 * numbers. `npx vitest run src/content/economy.slow.test.ts --disableConsoleIntercept` prints the figures.
 *
 * - Mining: the starter ship with a pod bay and pod, an ore bin and a refinery set to refine everything, working a fresh field for MINE_MIN
 *   game minutes in the real sim. Income = what it made (refined goods plus raw ore left over) at a trade station's buying price.
 * - Delivery: the job pay formula for a typical job (mid-range hops, danger 1) over the time it takes: per hop the route charge of a typical
 *   jump plus the hyperspace pacing, plus the hand-over (the station shuttle collecting the crate), measured in the real sim. Fuel is paid at
 *   the trade station's price. Accepting, docking and choosing jobs are free here, so this is the delivery loop at its best.
 */
const MINE_MIN = 10;
/** Target (issue #222): a built mining and refining setup earns 2-3x a delivery loop per game minute. */
const TARGET = { min: 2, max: 3 };

/** A trade station's market as a trader entity, for real prices (no stock swing, no reputation). */
function tradeStation(sim: Sim, profile = 'trader.station.trading', faction = 'station.trading'): number {
  const id = sim.world.createEntity();
  sim.world.add(id, TraderC, { profile, faction, name: 'Harness', credits: 1e6, stock: [], station: true });
  return id;
}

/** The first spot on the home ship where a module fits, scanning rows (from the end when `back`). */
function place(sim: Sim, def: string, back = false): number | null {
  const ship = homeShip(sim);
  const g = shipGrid(sim, ship)!;
  const spots: { x: number; y: number }[] = [];
  for (let y = g.y0; y < g.y0 + g.height; y++) for (let x = g.x0; x < g.x0 + g.width; x++) spots.push({ x, y });
  if (back) spots.reverse();
  for (const rot of [0, 1]) {
    const s = spots.find((p) => !placementError(sim, ship, def, p.x, p.y, rot));
    if (s) return spawnModule(sim, def, s.x, s.y, rot);
  }
  return null;
}

const GOODS = ['item.iron_ore', 'item.rare_ore', 'item.ice', 'item.metal', 'item.electronics', 'item.water', 'item.oxygen'];

export interface MiningResult {
  perMin: number;
  made: Record<string, number>;
}

function miningLoop(): MiningResult {
  const sim = newGame(7, content);
  sim.galaxy.fleets = [];
  const bay = place(sim, 'module.pod_bay');
  expect(bay).not.toBeNull();
  const pod = spawnVehicle(sim, 'vehicle.mining_pod', bay!);
  expect(place(sim, 'module.storage_ore', true)).not.toBeNull();
  const refinery = place(sim, 'module.refinery', true);
  expect(refinery).not.toBeNull();
  // Everything the refinery can make, the most valuable ore first (as a player would queue it).
  for (const recipe of ['recipe.refine_rare', 'recipe.refine_iron', 'recipe.refine_ice']) {
    if (sim.content.recipes[recipe]) sim.enqueue({ type: 'production.add', moduleId: refinery!, recipe, mode: 'count', target: 9999 });
  }
  sim.enqueue({ type: 'debug.spawnAsteroid', kind: 'field', seed: 3 });
  sim.step();
  const asteroid = [...sim.world.query(AsteroidC)][0]!;
  const start = Object.fromEntries(GOODS.map((i) => [i, totalStock(sim, i)]));
  sim.enqueue({ type: 'mining.order', pod, asteroid });
  for (let i = 0; i < MINE_MIN * 60 * TICK_HZ; i++) {
    sim.step();
    sim.events.drain();
  }
  const station = tradeStation(sim);
  const made: Record<string, number> = {};
  let credits = 0;
  for (const item of GOODS) {
    if (!sim.content.items[item]) continue;
    const n = totalStock(sim, item) - start[item]!;
    made[item] = n;
    credits += Math.max(0, n) * (unitPrice(sim, station, item, 'buy') ?? 0);
  }
  return { perMin: credits / MINE_MIN, made };
}

export interface DeliveryResult {
  perMin: number;
  reward: number;
  minutes: number;
}

/** Ticks from a delivery crate on deck (station in the node) to the hand-over: the station shuttle's round trip. */
function handoverTicks(): number {
  const sim = newGame(7, content);
  sim.galaxy.fleets = [];
  sim.enqueue({ type: 'debug.spawnStation', kind: 'station.trading', size: 'outpost' });
  sim.step();
  sim.enqueue({ type: 'debug.jobScenario', name: 'handover' });
  for (let i = 1; i < 5 * 60 * TICK_HZ; i++) {
    sim.step();
    if (sim.events.drain().some((e) => e.type === 'job.handedOver')) return i;
  }
  throw new Error('no hand-over within 5 minutes');
}

function deliveryLoop(): DeliveryResult {
  const sim = newGame(7, content);
  const hops = (DELIVERY_HOPS.min + DELIVERY_HOPS.max) / 2;
  const reward = DELIVERY_BASE + DELIVERY_PER_HOP * hops + DELIVERY_PER_DANGER * 1;
  // A typical route jump: a mid-length lane (about 160 units), one fuel.
  const chargeSec = Math.min(ROUTE_CHARGE.max, ROUTE_CHARGE.base + ROUTE_CHARGE.perUnit * 160);
  const hopSec = chargeSec + TURN_TICKS / TICK_HZ;
  const sec = hops * hopSec + handoverTicks() / TICK_HZ;
  const fuel = hops * (unitPrice(sim, tradeStation(sim), 'item.fuel', 'sell') ?? 0);
  const minutes = sec / 60;
  return { perMin: (reward - fuel) / minutes, reward, minutes };
}

describe('economy balance (issue #222)', () => {
  it(`a built mining and refining setup earns ${TARGET.min}-${TARGET.max}x a delivery loop per game minute`, () => {
    const d = deliveryLoop();
    const m = miningLoop();
    const ratio = m.perMin / d.perMin;
    {
      console.log(`delivery: ${d.reward} cr per job, ${d.minutes.toFixed(2)} min -> ${d.perMin.toFixed(1)} cr/min`);
      console.log(`mining:   ${m.perMin.toFixed(1)} cr/min over ${MINE_MIN} min, made ${JSON.stringify(m.made)}`);
      console.log(`ratio:    ${ratio.toFixed(2)}`);
    }
    expect(ratio).toBeGreaterThanOrEqual(TARGET.min);
    expect(ratio).toBeLessThanOrEqual(TARGET.max);
  });

  it('refining always adds value at a trade station', () => {
    const sim = newGame(7, content);
    const st = tradeStation(sim);
    for (const r of Object.values(sim.content.recipes)) {
      if (r.station !== 'module.refinery') continue;
      const value = (lines: readonly { item: string; count: number }[]) => lines.reduce((n, l) => n + (unitPrice(sim, st, l.item, 'buy') ?? 0) * l.count, 0);
      expect(value(r.outputs), r.name).toBeGreaterThan(value(r.inputs));
    }
  });
});
