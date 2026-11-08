import { describe, expect, it } from 'vitest';
import { START_NODE, FUEL_ITEM, TraderC, econOf, fuelStock, galaxyIndex, newGame, portsAt, type Sim } from '../sim';
import { bumpStat, currentAct } from '../sim/story/goals';
import { content } from '.';

const run = (sim: Sim, n: number): string[] => {
  const log: string[] = [];
  for (let i = 0; i < n; i++) {
    sim.step();
    for (const e of sim.events.drain()) log.push(e.type === 'command.rejected' ? `${e.type}:${e.command}:${e.reason}` : e.type);
  }
  return log;
};

/** Deploy at the first of a few spots the gap rule accepts (a node's own ships may be in the way of some). */
function deploy(sim: Sim): void {
  for (let y = 40; y <= 640; y += 60) {
    for (let x = -200; x <= 900; x += 60) {
      sim.enqueue({ type: 'sector.deploy', x, y });
      run(sim, 1);
      if (sim.sector.state === 'active') return;
    }
  }
}

/** The nearest node to the start with a trading station port, from the start. */
function tradeNode(sim: Sim): string {
  sim.enqueue({ type: 'debug.galaxyReveal', radius: 3 });
  run(sim, 1);
  const nodes = galaxyIndex(sim.galaxy).nodes;
  const dist = (id: string): number => Math.hypot(nodes.get(id)!.x, nodes.get(id)!.y);
  const hit = [...nodes.keys()].filter((id) => id !== START_NODE && portsAt(sim, id).some((p) => p.kind === 'station' && econOf(sim, p)?.profile === 'trader.station.trading')).sort((a, b) => dist(a) - dist(b) || (a < b ? -1 : 1))[0];
  if (!hit) throw new Error('no trade station node');
  return hit;
}

/** Fly (teleport) to a node with a trade station and deploy beside it. */
function atTradeStation(seed: number): { sim: Sim; station: number } {
  const sim = newGame(seed, content);
  run(sim, 5);
  const node = tradeNode(sim);
  sim.enqueue({ type: 'debug.galaxyTeleport', node });
  run(sim, 1);
  deploy(sim);
  expect(sim.sector.state).toBe('active');
  const station = sim.world.query(TraderC).find((id) => sim.world.get(id, TraderC)?.port && sim.world.get(id, TraderC)?.profile === 'trader.station.trading');
  if (station === undefined) throw new Error('no station trader');
  return { sim, station };
}

describe('fuel is for sale', () => {
  for (const seed of [1, 42]) {
    it(`seed ${seed}: a trade station sells fuel at a fair price and the purchase completes goal.buy_fuel`, () => {
      const { sim, station } = atTradeStation(seed);
      expect(sim.world.get(station, TraderC)!.stock.find((s) => s.item === FUEL_ITEM)?.count ?? 0).toBeGreaterThan(20);
      sim.trade.credits = 1000;
      const before = fuelStock(sim);
      // Act 1 done, so the flying act (and its buy_fuel goal) is the one being checked.
      sim.galaxy.visited['elsewhere'] = sim.tick;
      for (const s of ['jobsTaken', 'jobsDone']) bumpStat(sim, s);
      sim.enqueue({ type: 'trade.hail', ship: station });
      run(sim, 30);
      sim.enqueue({ type: 'trade.offer', ship: station, give: [], get: [{ item: FUEL_ITEM, count: 10 }] });
      run(sim, 30);
      const offer = sim.trade.offers[0]!;
      expect(offer.balance).toBeGreaterThan(0);
      expect(offer.balance).toBeLessThanOrEqual(10 * 12);
      sim.enqueue({ type: 'trade.accept', offer: offer.id });
      for (let i = 0; i < 200 && sim.trade.deals.at(-1)?.phase !== "done"; i++) run(sim, 60);
      expect(sim.trade.deals.at(-1)?.phase).toBe('done');
      run(sim, 600);
      expect(fuelStock(sim)).toBe(before + 10);
      expect(sim.story.goals.done).toContain('goal.buy_fuel');
      expect(currentAct(sim)?.id).toBe('act.flying');
    }, 120_000);
  }
});
