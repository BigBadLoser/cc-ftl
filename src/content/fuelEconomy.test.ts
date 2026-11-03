import { describe, expect, it } from 'vitest';
import {
  CombatC, FTL_CHARGE_SEC, ModuleC, StorageC, shipIdOf, spawnShip, storageAdd, FUEL_ITEM, START_NODE, TraderC, burnFuel, cheapestHop, deserialize, distressBlocker, econOf, fuelOnSale, fuelStock, galaxyIndex, isStranded, newGame,
  playerShip, portsAt, serialize, tugQuote, unitPrice, type Sim, type SimEvent,
} from '../sim';
import { reputationOf } from '../sim/story/state';
import { DISTRESS_TURNS } from '../sim/galaxy/tuning';
import { onTurn } from '../sim/galaxy/turn';
import { content } from '.';

const events: SimEvent[] = [];
const run = (sim: Sim, n: number): string[] => {
  const log: string[] = [];
  for (let i = 0; i < n; i++) {
    sim.step();
    for (const e of sim.events.drain()) {
      events.push(e);
      log.push(e.type === 'command.rejected' ? `${e.type}:${e.command}:${e.reason}` : e.type);
    }
  }
  return log;
};
const turns = (sim: Sim, n: number): void => {
  for (let i = 0; i < n; i++) onTurn(sim, ++sim.galaxy.turn, 'time');
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

/** A new game with every unit of fuel burnt: stranded at the start node. */
function stranded(seed = 7): Sim {
  const sim = newGame(seed, content);
  run(sim, 5);
  burnFuel(sim, fuelStock(sim));
  return sim;
}
/** Empty the start node's fuel shelf so nothing is on sale (a station that ran dry). */
function dryDock(sim: Sim): void {
  for (const p of portsAt(sim, sim.galaxy.current)) {
    const e = econOf(sim, p);
    if (e) sim.galaxy.markets[e.id] = { turn: sim.galaxy.turn, stock: { [FUEL_ITEM]: 0 } };
  }
}
const canJump = (sim: Sim): boolean => {
  const here = sim.galaxy.current;
  const edge = (galaxyIndex(sim.galaxy).adjacent.get(here) ?? []).find((e) => e.fuel === cheapestHop(sim));
  const to = edge && (edge.a === here ? edge.b : edge.a);
  if (!to) return false;
  sim.world.get(playerShip(sim), CombatC)!.ftl = FTL_CHARGE_SEC;
  sim.enqueue({ type: 'galaxy.jump', ship: playerShip(sim), route: [to] });
  run(sim, 2);
  return sim.sector.state === 'hyperspace';
};

describe('fuel is for sale', () => {
  for (const seed of [1, 7, 42]) {
    it(`seed ${seed}: a trade station stocks fuel at a fair price (market and live station)`, () => {
      const { sim, station } = atTradeStation(seed);
      const t = sim.world.get(station, TraderC)!;
      expect(t.stock.find((s) => s.item === FUEL_ITEM)?.count ?? 0).toBeGreaterThan(20);
      // Fair: a few credits a unit (the base price is 6), nowhere near the tug's price.
      const price = unitPrice(sim, station, FUEL_ITEM, 'sell')!;
      expect(price).toBeGreaterThanOrEqual(4);
      expect(price).toBeLessThanOrEqual(12);
      expect(sim.content.galaxy?.market.goods).toContain(FUEL_ITEM);
    });
  }

  it('trade stations, mining outposts and farms all make fuel; a trade station nets the most', () => {
    const sim = newGame(7, content);
    const rates = sim.content.galaxy!.market.rates;
    for (const profile of ['trader.station.trading', 'trader.station.mining', 'trader.station.farming']) expect(rates[profile]?.produce?.[FUEL_ITEM], profile).toBeGreaterThan(0);
    expect(rates['trader.station.trading']!.produce![FUEL_ITEM]).toBeGreaterThan(rates['trader.station.mining']!.produce![FUEL_ITEM]!);
  });
});

describe('stranded and the distress tug', () => {
  it('a ship with fuel, or one that can buy it here, cannot call a tug', () => {
    const sim = newGame(7, content);
    run(sim, 5);
    expect(distressBlocker(sim)).toBe('notStranded');
    burnFuel(sim, fuelStock(sim));
    expect(isStranded(sim)).toBe(true);
    // The start station sells fuel and the player has the credits: buy it.
    expect(fuelOnSale(sim)).toBeGreaterThan(0);
    expect(distressBlocker(sim)).toBe('fuelOnSale');
    sim.enqueue({ type: 'galaxy.distress' });
    expect(run(sim, 1)).toContain('command.rejected:galaxy.distress:fuelOnSale');
  });

  it('a dry or unaffordable station is no way out: the call is allowed, and a tug comes after the delay', () => {
    const sim = stranded();
    dryDock(sim);
    expect(distressBlocker(sim)).toBe('');
        sim.enqueue({ type: 'galaxy.distress' });
    expect(run(sim, 1)).toContain('galaxy.distressSent');
    expect(sim.galaxy.distress).toEqual({ node: START_NODE, sent: sim.galaxy.turn, due: sim.galaxy.turn + DISTRESS_TURNS });
    sim.enqueue({ type: 'galaxy.distress' });
    expect(run(sim, 1)).toContain('command.rejected:galaxy.distress:alreadyCalled');
    turns(sim, DISTRESS_TURNS - 1);
    expect(fuelStock(sim)).toBe(0);
    const credits = sim.trade.credits;
    const quote = tugQuote(sim);
    turns(sim, 1);
    run(sim, 1);
    expect(sim.galaxy.distress).toBeNull();
    expect(fuelStock(sim)).toBe(quote.fuel);
    expect(sim.trade.credits).toBe(credits - quote.total);
    const arrived = events.find((e) => e.type === 'galaxy.towArrived');
    expect(arrived).toMatchObject({ fuel: quote.fuel, paid: quote.total, owed: 0 });
    expect(isStranded(sim)).toBe(false);
    expect(canJump(sim)).toBe(true);
  });

  it('with no credits the tug still comes: the unpaid part costs reputation with the traders, never a dead end', () => {
    const sim = stranded(1);
    dryDock(sim);
    sim.trade.credits = 10;
    const rep = reputationOf(sim.story, 'traders');
    sim.enqueue({ type: 'galaxy.distress' });
    run(sim, 1);
    turns(sim, DISTRESS_TURNS);
    run(sim, 1);
    expect(sim.trade.credits).toBe(0);
    expect(fuelStock(sim)).toBe(tugQuote(sim).fuel);
    expect(reputationOf(sim.story, 'traders')).toBeLessThan(rep);
    expect(canJump(sim)).toBe(true);
  });

  it('a pending call is deterministic and saves with the game', () => {
    const play = (): Sim => {
      const sim = stranded();
      dryDock(sim);
      sim.enqueue({ type: 'galaxy.distress' });
      run(sim, 1);
      return sim;
    };
    const a = play();
    const b = deserialize(serialize(a), content);
    expect(b.galaxy.distress).toEqual(a.galaxy.distress);
    expect(b.galaxy.distress).not.toBeNull();
    for (const sim of [a, b]) {
      turns(sim, DISTRESS_TURNS);
      run(sim, 1);
    }
    expect(fuelStock(b)).toBe(fuelStock(a));
    expect(fuelStock(a)).toBeGreaterThan(0);
    expect(serialize(b)).toEqual(serialize(a));
    expect(serialize(play())).toEqual(serialize(play()));
  });
});

describe('review fixes', () => {
  it('a seller that refuses to trade with the player does not count as fuel on sale', () => {
    const sim = newGame(7, content);
    run(sim, 5);
    burnFuel(sim, fuelStock(sim));
    expect(fuelOnSale(sim)).toBeGreaterThan(0);
    // Standing with the traders so low that the station will not answer a hail.
    sim.story.reputation['traders'] = -10;
    expect(fuelOnSale(sim)).toBe(0);
    expect(distressBlocker(sim)).toBe('');
    sim.enqueue({ type: 'galaxy.distress' });
    expect(run(sim, 1)).toContain('galaxy.distressSent');
  });

  it('the tug fills the flown ship, never another player ship, even when its storage is full', () => {
    const sim = stranded();
    dryDock(sim);
    const flown = playerShip(sim);
    const second = spawnShip(sim, content.ships['ship.starter'], { faction: 'player', x: 600, y: 600 });
    const storeOf = (ship: number): number[] => sim.world.query(StorageC, ModuleC).filter((id) => shipIdOf(sim, sim.world.get(id, ModuleC)) === ship);
    expect(storeOf(second).length).toBeGreaterThan(0);
    const before = fuelStock(sim, second);
    for (const id of storeOf(flown)) storageAdd(sim, id, 'item.scrap_hull', 100000);
    sim.enqueue({ type: 'galaxy.distress' });
    run(sim, 1);
    turns(sim, DISTRESS_TURNS);
    run(sim, 1);
    expect(fuelStock(sim, flown)).toBe(tugQuote(sim).fuel);
    expect(fuelStock(sim, second)).toBe(before);
  });
});
