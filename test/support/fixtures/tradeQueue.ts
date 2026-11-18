/** Shared setups of the queued-deal tests and their slow tier: a started game with a hailed trading outpost, and deals agreed with it. */
import { ShipC } from '../../../src/sim/combat/components';
import { newGame } from '../../../src/sim/newGame';
import type { Sim } from '../../../src/sim/sim';
import { isLive } from '../../../src/sim/trade/deals';
import { TraderC } from '../../../src/sim/trade/types';
import { content } from '../content';
import { cachedWorld } from '../world';

export const stockOf = (sim: Sim, st: number, item: string): number => sim.world.get(st, TraderC)!.stock.find((s) => s.item === item)?.count ?? 0;
export const METAL = { item: 'item.metal', count: 10 };

/** Reject reasons seen so far: every `step` of a game is drained into its list (see `rejected`). */
const seen = new WeakMap<Sim, string[]>();
export function rejected(sim: Sim): string[] {
  const out: string[] = [];
  seen.set(sim, out);
  return out;
}
export function step(sim: Sim): void {
  sim.step();
  for (const e of sim.events.drain()) if (e.type === 'command.rejected') seen.get(sim)?.push(e.reason);
}

const stationOf = (sim: Sim): number => sim.world.query(ShipC).find((i) => sim.world.get(i, ShipC)!.immobile)!;

function build(): Sim {
  const sim = newGame(1, content);
  sim.enqueue({ type: 'debug.spawnStation', kind: 'station.trading', size: 'outpost', seed: 4 });
  step(sim);
  sim.enqueue({ type: 'trade.hail', ship: stationOf(sim) });
  step(sim);
  return sim;
}

/** A started game with a hailed trading outpost (built once per file, a fresh clone per call). */
export function setup(): { sim: Sim; st: number } {
  const sim = cachedWorld('tradeQueue:setup', build);
  return { sim, st: stationOf(sim) };
}

/** `setup` with a first buy of ten metal agreed and carried to the run home (its `back` phase): the queue tests that need the first deal near its end start here. */
export function firstBack(): { sim: Sim; st: number } {
  const sim = cachedWorld('tradeQueue:firstBack', () => {
    const g = build();
    const first = agree(g, stationOf(g), [], [METAL])!;
    for (let i = 0; i < 3000 && first.phase !== 'back'; i++) step(g);
    return g;
  });
  return { sim, st: stationOf(sim) };
}

/** Propose and accept in two steps; returns the new deal. */
export function agree(sim: Sim, ship: number, give: { item: string; count: number }[], get: { item: string; count: number }[]) {
  const before = sim.trade.deals.length;
  sim.enqueue({ type: 'trade.offer', ship, give, get });
  step(sim);
  const offer = sim.trade.offers.find((o) => o.ship === ship);
  if (offer) {
    sim.enqueue({ type: 'trade.accept', offer: offer.id });
    step(sim);
  }
  return sim.trade.deals.length > before ? sim.trade.deals[sim.trade.deals.length - 1] : undefined;
}

export function runOut(sim: Sim, max = 20000): void {
  for (let i = 0; i < max && sim.trade.deals.some(isLive); i++) step(sim);
}
