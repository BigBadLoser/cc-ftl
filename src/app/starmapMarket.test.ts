import { describe, expect, it } from 'vitest';
import { TraderC, bindMarkets, newGame } from '../sim';
import { touchMarket } from '../sim/trade/deals';
import { content } from '../content';
import { buildStarmap } from './starmapSnapshot';

describe('starmap market line follows player trades', () => {
  /** A new game with a trading station spawned in the start node (which has a trade-station port). */
  const live = () => {
    const sim = newGame(3, content);
    for (let i = 0; i < 20; i++) sim.step();
    sim.enqueue({ type: 'debug.spawnStation', kind: 'station.trading', size: 'outpost', seed: 4 });
    sim.step();
    const station = sim.world.query(TraderC).find((i) => sim.world.get(i, TraderC)!.station)!;
    return { sim, station };
  };

  it('a player deal at a live port bumps the galaxy revision, so the starmap market line is rebuilt and shows the new stock', () => {
    const { sim, station } = live();
    bindMarkets(sim);
    const t = sim.world.get(station, TraderC)!;
    // Scarce metal reads dear on the map; the player then sells a pile of it in, which makes it plentiful (cheap).
    t.stock = t.stock.filter((l) => l.item !== 'item.metal');
    sim.galaxy.rev++;
    const before = buildStarmap(sim);
    expect(before.nodes.find((n) => n.current)?.market?.dear.map((g) => g.name)).toContain('Metal');
    const rev = sim.galaxy.rev;
    // The deal flow writes the live station's stock: opening a deal that takes goods, then failing it, returns them.
    sim.enqueue({ type: 'trade.hail', ship: station });
    for (let i = 0; i < 3; i++) sim.step();
    const ration = t.stock.find((l) => l.item === 'item.ration');
    expect(ration).toBeDefined();
    sim.enqueue({ type: 'trade.offer', ship: station, give: [], get: [{ item: 'item.ration', count: 5 }] });
    for (let i = 0; i < 3; i++) sim.step();
    sim.enqueue({ type: 'trade.accept', offer: sim.trade.offers[0]!.id });
    for (let i = 0; i < 3; i++) sim.step();
    expect(sim.galaxy.rev).toBeGreaterThan(rev);
    // The same change is visible through the snapshot: a rebuilt map reads the station's stock now.
    t.stock = t.stock.filter((l) => l.item !== 'item.metal').concat([{ item: 'item.metal', count: 400 }]);
    const rev2 = sim.galaxy.rev;
    touchMarket(sim, t);
    expect(sim.galaxy.rev).toBe(rev2 + 1);
    const after = buildStarmap(sim);
    expect(after.rev).toBe(sim.galaxy.rev);
    expect(after.nodes.find((n) => n.current)?.market?.cheap.map((g) => g.name)).toContain('Metal');
  }, 60000);
});
