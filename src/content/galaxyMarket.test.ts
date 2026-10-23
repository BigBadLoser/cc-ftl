import { describe, expect, it } from 'vitest';
import {
  TraderC, advance, bindMarkets, capOf, deserialize, econOf, factorAt, galaxyIndex, moveStock, newGame, portOf, serialize, stockAt, unbindMarkets, unitPrice,
  type Econ, type Sim,
} from '../sim';
import type { Port } from '../sim';
import { onDock, onWork } from '../sim/galaxy/dock';
import { liveTrader } from '../sim/galaxy/market';
import { MARKET_DRIFT, MINER_ORE } from '../sim/galaxy/tuning';
import { syncFleets } from '../sim/galaxy/fleets';
import { onTurn } from '../sim/galaxy/turn';
import type { Fleet } from '../sim/galaxy/types';
import { content } from '.';

const parked = (seed: number): Sim => {
  const sim = newGame(seed, content);
  sim.sector.state = 'deploying';
  return sim;
};
const turns = (sim: Sim, n: number): void => {
  for (let i = 0; i < n; i++) onTurn(sim, ++sim.galaxy.turn);
};
const homes = (sim: Sim) => [...new Set(sim.galaxy.fleets.map((f) => f.home))].sort().map((id) => portOf(sim, id)!);
/** A port whose market has the given profile, from the fleets' homes. */
const portWith = (sim: Sim, profile: string) => homes(sim).find((p) => econOf(sim, p)?.profile === profile);
const econ = (sim: Sim, profile: string): Econ => econOf(sim, portWith(sim, profile)!)!;
/** `n` distinct ports with trade-station markets. */
const stations = (sim: Sim, n: number) => homes(sim).filter((p) => p.kind === 'station' && econOf(sim, p)).slice(0, n);
const traderFleet = (sim: Sim): Fleet => sim.galaxy.fleets.find((f) => f.role === 'trader')!;
/** The first seed whose area has a mining outpost with a miner, a trading station and a farm (the start area differs by seed). */
const richSeed = (): number => {
  for (let seed = 21; seed < 80; seed++) {
    const sim = parked(seed);
    const profiles = new Set(homes(sim).map((p) => econOf(sim, p)?.profile));
    if (['trader.station.mining', 'trader.station.trading', 'trader.station.farming'].every((x) => profiles.has(x)) && sim.galaxy.fleets.some((f) => f.role === 'miner')
      && stations(sim, 3).length === 3 && sim.galaxy.fleets.some((f) => f.role === 'trader')) return seed;
  }
  throw new Error('no seed with every kind of port');
};
const stockOf = (sim: Sim, e: Econ, item: string, at = sim.galaxy.turn) => stockAt(sim, e, at)[item] ?? 0;
const set = (sim: Sim, e: Econ, item: string, to: number) => moveStock(sim, e, sim.galaxy.turn, item, to - stockOf(sim, e, item));

const SEED = richSeed();

describe('port markets', () => {
  it('ports have a market by kind; nests have none', () => {
    const sim = parked(SEED);
    const ports = homes(sim);
    expect(new Set(ports.map((p) => p.kind)).size).toBeGreaterThan(2);
    for (const p of ports) expect(econOf(sim, p) === null, p.kind).toBe(p.kind === 'nest');
  });

  it('produces and consumes per turn by kind, scaled by size', () => {
    const sim = parked(SEED);
    const mine = econ(sim, 'trader.station.mining');
    const at = (n: number) => advance(mine, { turn: 0, stock: {} }, n);
    expect(mine.net['item.iron_ore']).toBeGreaterThan(0);
    expect(mine.net['item.ration']).toBeLessThan(0);
    // One turn moves a share of the way to the level (baseline + net / drift): up for what it digs, down for what it eats.
    expect(at(1)['item.iron_ore']).toBeGreaterThan(mine.base['item.iron_ore'] as number);
    expect(at(1)['item.ration']).toBeLessThan(mine.base['item.ration'] as number);
    const level = (mine.base['item.iron_ore'] as number) + (mine.net['item.iron_ore'] as number) / MARKET_DRIFT;
    expect(at(1)['item.iron_ore']).toBeCloseTo((mine.base['item.iron_ore'] as number) + (level - (mine.base['item.iron_ore'] as number)) * MARKET_DRIFT, 6);
    // Sizes scale the rates: a size 3 port nets three times a size 1 port.
    const a = homes(sim).find((p) => econOf(sim, p)?.profile === 'trader.station.mining' && p.size === 1);
    const b = homes(sim).find((p) => econOf(sim, p)?.profile === 'trader.station.mining' && p.size > 1);
    if (a && b) expect((econOf(sim, b)!.net['item.metal'] as number) / (econOf(sim, a)!.net['item.metal'] as number)).toBeCloseTo(b.size, 6);
    // Trading stations eat; farms feed; dens scrap and eat.
    expect(econ(sim, 'trader.station.trading').net['item.metal']).toBeLessThan(0);
  });

  it('prices follow stock against the baseline: cheap when plentiful, dear when scarce, 1 at the baseline', () => {
    const sim = parked(SEED);
    const e = econ(sim, 'trader.station.trading');
    const b = e.base['item.ration'] as number;
    expect(b).toBeGreaterThan(0);
    expect(factorAt(e, 'item.ration', b)).toBe(1);
    expect(factorAt(e, 'item.ration', 0)).toBeGreaterThan(1.3);
    expect(factorAt(e, 'item.ration', b * 3)).toBeLessThan(0.8);
    expect(factorAt(e, 'item.ration', b * 3)).toBeGreaterThanOrEqual(0.5);
    expect(factorAt(e, 'item.ration', 0)).toBeLessThanOrEqual(1.6);
    expect(factorAt(e, 'item.fuel', 5)).toBe(1);
  });

  it('drifts back to its level slowly when nobody trades, and the stock stays within [0, cap]', () => {
    const sim = parked(SEED);
    const e = econ(sim, 'trader.station.trading');
    const item = 'item.polymer';
    const level = (e.base[item] as number) + (e.net[item] as number) / MARKET_DRIFT;
    set(sim, e, item, 0);
    const turn0 = sim.galaxy.turn;
    const near = (n: number) => stockAt(sim, e, turn0 + n)[item] as number;
    expect(near(1)).toBeGreaterThan(0);
    expect(near(1)).toBeLessThan(near(10));
    expect(near(10)).toBeLessThan(near(100));
    expect(near(10)).toBeLessThan(level * 0.6);
    expect(Math.abs(near(400) - level)).toBeLessThan(0.5);
    // Bounds, both ways, whatever is thrown at it.
    expect(moveStock(sim, e, turn0, item, 1e6)).toBeLessThanOrEqual(capOf(e.base[item] as number));
    expect(stockOf(sim, e, item, turn0)).toBeLessThanOrEqual(capOf(e.base[item] as number));
    moveStock(sim, e, turn0, item, -1e6);
    expect(stockOf(sim, e, item, turn0)).toBe(0);
    for (const v of Object.values(stockAt(sim, e, turn0 + 5000))) expect(v).toBeGreaterThanOrEqual(0);
    for (const [k, v] of Object.entries(stockAt(sim, e, turn0 + 5000))) expect(v, k).toBeLessThanOrEqual(capOf(e.base[k] ?? 0) + 1e-9);
  });

  it('a frozen port caught up in one step equals the same port stepped turn by turn', () => {
    const sim = parked(SEED);
    const e = econ(sim, 'trader.station.mining');
    moveStock(sim, e, 0, 'item.metal', -50);
    const st = structuredClone(sim.galaxy.markets[e.id]!);
    let walked = Object.fromEntries(e.items.map((i) => [i, st.stock[i] ?? e.base[i] ?? 0]));
    for (let t = st.turn + 1; t <= st.turn + 80; t++) walked = advance(e, { turn: t - 1, stock: walked }, t);
    const jumped = advance(e, st, st.turn + 80);
    for (const item of e.items) expect(jumped[item], item).toBeCloseTo(walked[item] as number, 6);
  });
});

type Stop = { p: Port; e: Econ };

describe('NPC traders and miners', () => {
  const setup = () => {
    const sim = parked(SEED);
    const [a, b, c] = stations(sim, 3).map((p) => ({ p, e: econOf(sim, p)! })) as [Stop, Stop, Stop];
    const f = traderFleet(sim);
    f.synced = sim.galaxy.turn;
    f.ships[0]!.size = 'medium';
    f.node = a.p!.node;
    delete f.cargo;
    delete f.pick;
    return { sim, a, b, c, f };
  };

  it('buys what is cheap here and dear at the stop that pays best, sells at the next dock, and moves both stocks', () => {
    const { sim, a, b, c, f } = setup();
    for (const x of [a, b, c]) for (const g of content.galaxy.market.goods) set(sim, x.e, g, x.e.base[g] ?? 0);
    set(sim, a.e, 'item.ration', 90);
    set(sim, b.e, 'item.ration', 0);
    set(sim, c.e, 'item.ration', (c.e.base['item.ration'] as number) + 10);
    const before = stockOf(sim, a.e, 'item.ration');
    onDock(sim, f, a.p, () => [c.p.node, b.p.node]);
    expect(f.pick).toBe(b.p.node);
    const load = f.cargo!.find((l) => l.item === 'item.ration')!.count;
    expect(load).toBeGreaterThan(0);
    expect(stockOf(sim, a.e, 'item.ration')).toBe(before - load);
    expect(f.cargo!.reduce((n, l) => n + l.count, 0)).toBeLessThanOrEqual(40);
    const there = stockOf(sim, b.e, 'item.ration');
    f.node = b.p.node;
    onDock(sim, f, b.p, () => []);
    expect(stockOf(sim, b.e, 'item.ration')).toBe(there + load);
    expect(f.cargo).toBeUndefined();
    // Prices moved: rations got dearer where it left, cheaper where it delivered.
    expect(factorAt(a.e, 'item.ration', stockOf(sim, a.e, 'item.ration'))).toBeGreaterThan(factorAt(a.e, 'item.ration', before));
  });

  it('picks the more profitable of two stops, whichever order they come in', () => {
    for (const order of [0, 1]) {
      const { sim, a, b, c, f } = setup();
      for (const x of [a, b, c]) for (const g of content.galaxy.market.goods) set(sim, x.e, g, x.e.base[g] ?? 0);
      for (const x of [a, b, c]) expect(x.e.base['item.ration']).toBeGreaterThan(0);
      set(sim, a.e, 'item.ration', 3 * (a.e.base['item.ration'] as number));
      set(sim, b.e, 'item.ration', 0);
      set(sim, c.e, 'item.ration', c.e.base['item.ration'] as number);
      onDock(sim, f, a.p, () => (order ? [b.p.node, c.p.node] : [c.p.node, b.p.node]));
      expect(f.pick).toBe(b.p.node);
    }
  });

  it('carries nothing and picks nothing when no stop pays', () => {
    const { sim, a, b, f } = setup();
    for (const x of [a, b]) for (const g of content.galaxy.market.goods) set(sim, x.e, g, x.e.base[g] ?? 0);
    onDock(sim, f, a.p, () => [b.p.node]);
    expect(f.pick).toBeUndefined();
    expect(f.cargo).toBeUndefined();
  });

  it('a shelf that is full takes only what fits; the rest is dumped', () => {
    const { sim, a, f } = setup();
    set(sim, a.e, 'item.scrap', capOf(a.e.base['item.scrap'] ?? 0) - 5);
    f.cargo = [{ item: 'item.scrap', count: 30 }];
    onDock(sim, f, a.p, () => []);
    expect(stockOf(sim, a.e, 'item.scrap')).toBeLessThanOrEqual(capOf(a.e.base['item.scrap'] ?? 0));
    expect(f.cargo).toBeUndefined();
  });

  it('a miner digs ore at its field and delivers it to its home outpost', () => {
    const sim = parked(SEED);
    const f = sim.galaxy.fleets.find((x) => x.role === 'miner' && econOf(sim, portOf(sim, x.home)!))!;
    const home = portOf(sim, f.home)!;
    const e = econOf(sim, home)!;
    f.synced = sim.galaxy.turn;
    f.node = 'elsewhere';
    onWork(sim, f);
    const cap = f.ships.reduce((n, c) => n + { small: 20, medium: 40, heavy: 80 }[c.size ?? 'small'], 0);
    expect(f.cargo!.map((l) => l.item)).toEqual([...MINER_ORE]);
    expect(f.cargo!.reduce((n, l) => n + l.count, 0)).toBe(cap);
    const before = stockOf(sim, e, 'item.iron_ore');
    const dug = f.cargo![0]!.count;
    f.node = home.node;
    onDock(sim, f, home, () => []);
    expect(f.cargo).toBeUndefined();
    expect(stockOf(sim, e, 'item.iron_ore')).toBeCloseTo(Math.min(before + dug, capOf(e.base['item.iron_ore'] ?? 0)), 6);
  });

  it('a running world trades: after a hundred turns some trader has carried cargo and some market has moved off its baseline', () => {
    const sim = parked(SEED);
    let carried = 0;
    for (let i = 0; i < 100; i++) {
      turns(sim, 1);
      carried += sim.galaxy.fleets.filter((f) => f.cargo?.length).length;
    }
    expect(carried).toBeGreaterThan(0);
    expect(Object.keys(sim.galaxy.markets).length).toBeGreaterThan(0);
    for (const [id, st] of Object.entries(sim.galaxy.markets)) {
      const e = econOf(sim, portOf(sim, id)!)!;
      for (const [item, v] of Object.entries(st.stock)) expect(v, `${id} ${item}`).toBeLessThanOrEqual(capOf(e.base[item] ?? 0) + 1e-9);
    }
  });

  it('fleets caught up after an absence trade against the same markets as fleets stepped through it', () => {
    const k = 40;
    const stepped = parked(SEED);
    turns(stepped, k);
    const away = parked(SEED);
    const home = away.galaxy.current;
    away.galaxy.current = '__elsewhere__';
    away.galaxy.turn += k;
    away.galaxy.current = home;
    syncFleets(away, away.galaxy.turn);
    expect(Object.keys(stepped.galaxy.markets).length).toBeGreaterThan(0);
    expect(JSON.stringify(away.galaxy.markets)).toBe(JSON.stringify(stepped.galaxy.markets));
    expect(JSON.stringify(away.galaxy.fleets.map((f) => [f.cargo, f.pick]))).toBe(JSON.stringify(stepped.galaxy.fleets.map((f) => [f.cargo, f.pick])));
  });

  it('save and load in the middle of a trip, cargo and all, then both runs agree', () => {
    const sim = parked(SEED);
    turns(sim, 60);
    expect(sim.galaxy.fleets.some((f) => f.cargo?.length)).toBe(true);
    const copy = deserialize(JSON.parse(JSON.stringify(serialize(sim))), content);
    copy.sector.state = 'deploying';
    expect(JSON.stringify(copy.galaxy.fleets)).toBe(JSON.stringify(sim.galaxy.fleets));
    expect(JSON.stringify(copy.galaxy.markets)).toBe(JSON.stringify(sim.galaxy.markets));
    turns(sim, 25);
    turns(copy, 25);
    expect(JSON.stringify(copy.galaxy.fleets)).toBe(JSON.stringify(sim.galaxy.fleets));
    expect(JSON.stringify(copy.galaxy.markets)).toBe(JSON.stringify(sim.galaxy.markets));
  });
});

describe('the live station and the world market', () => {
  /** A new game with a trading station spawned in the start node (which has a trade-station port). */
  const live = () => {
    const sim = newGame(3, content);
    for (let i = 0; i < 20; i++) sim.step();
    sim.enqueue({ type: 'debug.spawnStation', kind: 'station.trading', size: 'outpost', seed: 4 });
    sim.step();
    const station = sim.world.query(TraderC).find((i) => sim.world.get(i, TraderC)!.station)!;
    return { sim, station };
  };

  it('binds on entering: the trader is the port\'s market, with its baseline and the same prices', () => {
    const { sim, station } = live();
    const t = sim.world.get(station, TraderC)!;
    expect(t.port).toBeUndefined();
    bindMarkets(sim);
    expect(t.port).toMatch(/^s\.0\.0\.n0#/);
    const e = econOf(sim, portOf(sim, t.port!)!)!;
    expect(t.profile).toBe(e.profile);
    expect(liveTrader(sim, e.id)).toBe(station);
    const have = (item: string) => t.stock.find((l) => l.item === item)?.count ?? 0;
    for (const item of ['item.metal', 'item.ration']) expect(have(item)).toBe(Math.round(advance(e, { turn: 0, stock: {} }, sim.galaxy.turn)[item] as number));
    // Scarcity shows in what the player is quoted.
    const price = unitPrice(sim, station, 'item.metal', 'sell')!;
    t.stock = t.stock.filter((l) => l.item !== 'item.metal');
    expect(unitPrice(sim, station, 'item.metal', 'sell')!).toBeGreaterThan(price);
  });

  it('player trades move the world market: written back on leaving, restored on returning, one copy at a time', () => {
    const { sim, station } = live();
    bindMarkets(sim);
    const t = sim.world.get(station, TraderC)!;
    const e = econOf(sim, portOf(sim, t.port!)!)!;
    // A deal takes 7 metal off the shelf and adds 3 scrap.
    const metal = t.stock.find((l) => l.item === 'item.metal')!;
    const was = metal.count;
    metal.count -= 7;
    const scrap = t.stock.find((l) => l.item === 'item.scrap');
    if (scrap) scrap.count += 3;
    else t.stock.push({ item: 'item.scrap', count: 3 });
    // While live, an NPC docking moves the trader's own stock (no second copy).
    expect(moveStock(sim, e, sim.galaxy.turn, 'item.metal', -2)).toBe(-2);
    expect(t.stock.find((l) => l.item === 'item.metal')!.count).toBe(was - 9);
    expect(stockAt(sim, e, sim.galaxy.turn)['item.metal']).toBe(was - 9);
    unbindMarkets(sim);
    expect(t.port).toBeUndefined();
    expect(sim.galaxy.markets[e.id]!.turn).toBe(sim.galaxy.turn);
    expect(stockAt(sim, e, sim.galaxy.turn)['item.metal']).toBe(was - 9);
    expect(stockAt(sim, e, sim.galaxy.turn)['item.scrap']).toBeGreaterThanOrEqual(3);
    bindMarkets(sim);
    expect(t.stock.find((l) => l.item === 'item.metal')!.count).toBe(was - 9);
  });

  it('a live market keeps moving each turn, and survives a real jump away and back', () => {
    const { sim, station } = live();
    bindMarkets(sim);
    const t = sim.world.get(station, TraderC)!;
    const port = t.port!;
    const e = econOf(sim, portOf(sim, port)!)!;
    const start = t.stock.map((l) => l.item + l.count).join();
    for (let i = 0; i < 30; i++) onTurn(sim, ++sim.galaxy.turn);
    expect(t.stock.map((l) => l.item + l.count).join()).not.toBe(start);
    for (const l of t.stock) expect(l.count).toBeLessThanOrEqual(capOf(e.base[l.item] ?? 0));
    const home = sim.sector.node;
    const away = (galaxyIndex(sim.galaxy).adjacent.get(home) ?? []).map((x) => (x.a === home ? x.b : x.a)).sort()[0]!;
    const shelved = Object.fromEntries(t.stock.map((l) => [l.item, l.count]));
    sim.enqueue({ type: 'debug.galaxyTeleport', node: away });
    sim.step();
    expect(sim.galaxy.markets[port]).toBeDefined();
    for (const [item, n] of Object.entries(shelved)) expect(stockAt(sim, e, sim.galaxy.turn)[item], item).toBeCloseTo(n, 1);
    sim.enqueue({ type: 'sector.deploy', x: 40, y: 40 });
    sim.step();
    sim.enqueue({ type: 'debug.galaxyTeleport', node: home });
    sim.step();
    const back = sim.world.get(station, TraderC)!;
    expect(back.port).toBe(port);
    expect(back.stock.length).toBeGreaterThan(0);
  });
});
