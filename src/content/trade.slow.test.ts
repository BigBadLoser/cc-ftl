import { describe, expect, it } from 'vitest';
import { CombatC, ShipC, StorageC, TraderC, ModuleC, deserialize, newGame, serialize, storageAdd, isContraband, unitPrice, quote, hailVerdict, reputationWith, playerItems, type Sim, type SimEvent } from '../sim';
import { content } from './index';
import { shipIdOf } from '../sim/regions';
import { shipIds } from '../sim/regions';

/** The ship with ordinal `n` (1 = the player's, 2 = the first enemy). */
const nth = (sim: Sim, n: number): number => shipIds(sim)[n - 1] as number;

const run = (sim: Sim, n: number): SimEvent[] => {
  const out: SimEvent[] = [];
  for (let i = 0; i < n; i++) {
    sim.step();
    out.push(...sim.events.drain());
  }
  return out;
};
const ofType = <T extends SimEvent['type']>(events: SimEvent[], type: T): Extract<SimEvent, { type: T }>[] =>
  events.filter((e): e is Extract<SimEvent, { type: T }> => e.type === type);
const rejected = (events: SimEvent[]): string[] => ofType(events, 'command.rejected').map((e) => e.reason);

/** A started game with a generated civilian ship of the wanted role in the node (searching seeds for it). */
function withCivilian(role: string, gameSeed = 1): { sim: Sim; ship: number } {
  for (let seed = 1; seed < 80; seed++) {
    const sim = newGame(gameSeed, content);
    sim.galaxy.fleets = []; // keep NPC traffic out of this long run (fleets arrive in the node every minute)
    sim.enqueue({ type: 'debug.spawnGenerated', faction: 'faction.civilian', seed, depth: 2, cx: 130, cy: 70 });
    sim.step();
    sim.events.drain();
    const ship = sim.world.query(ShipC).find((i) => sim.world.get(i, ShipC)!.gen?.role === role);
    if (ship) return { sim, ship };
  }
  throw new Error(`no civilian ${role} found`);
}

/** A started game with a trading outpost (a generated station grid) and the hail already answered. */
function withStation(): { sim: Sim; station: number } {
  const sim = newGame(7, content);
  sim.galaxy.fleets = []; // keep NPC traffic out of this long run (fleets arrive in the node every minute)
  sim.enqueue({ type: 'debug.spawnStation', kind: 'station.trading', size: 'outpost', seed: 4, name: 'Haven' });
  sim.step();
  const station = [...sim.world.query(TraderC)][0] as number;
  sim.enqueue({ type: 'trade.hail', ship: station });
  run(sim, 2);
  return { sim, station };
}

/** Items that change hands: all but a job's sealed cargo (ItemDef.cargo), which is never for sale. */
const traded = Object.entries(content.items).filter(([, d]) => !(d as { cargo?: true }).cargo);

describe('content', () => {
  it('prices every item but job cargo, and every trader stocks only priced items; faction and trader tables resolve', () => {
    for (const [id, d] of traded) expect((d as { price?: number }).price, id).toBeGreaterThan(0);
    for (const [id, t] of Object.entries(content.trade.traders)) {
      for (const s of t.stock) expect(content.items[s.item as keyof typeof content.items], `${id} ${s.item}`).toBeDefined();
      const fid = (t.match as { faction?: string }).faction;
      if (fid) expect(content.trade.factions[fid as keyof typeof content.trade.factions] ?? content.factions[fid as keyof typeof content.factions], `${id} faction`).toBeDefined();
    }
    for (const f of Object.values(content.trade.factions)) expect(typeof f.reputation).toBe('string');
    expect(content.trade.startCredits).toBe(500);
  });
  it('the player starts with the starting credits', () => {
    expect(newGame(1, content).trade.credits).toBe(500);
  });
});

describe('pricing', () => {
  it('a trader buys for less than it sells, for every item, trader kind and reputation: no arbitrage', () => {
    const { sim, station } = withStation();
    const t = sim.world.get(station, TraderC)!;
    for (const profile of Object.keys(content.trade.traders)) {
      t.profile = profile;
      for (const faction of Object.keys(content.trade.factions)) {
        t.faction = faction;
        for (const rep of [-8, -2, 0, 3, 9]) {
          sim.story.reputation[content.trade.factions[faction as keyof typeof content.trade.factions].reputation] = rep;
          for (const [item] of traded) {
            const sell = unitPrice(sim, station, item, 'sell')!;
            const buy = unitPrice(sim, station, item, 'buy');
            // Only a black market buys contraband; a plain trader does not buy it at all.
            if (buy === null) {
              expect(isContraband(sim, item), `${profile} ${faction} ${item}`).toBe(true);
              continue;
            }
            expect(buy, `${profile} ${faction} rep ${rep} ${item}`).toBeLessThanOrEqual(sell);
            expect(buy).toBeGreaterThanOrEqual(1);
          }
        }
      }
    }
  });

  it('applies the spread, the faction, the trader kind, item tags and reputation', () => {
    const { sim, station } = withStation();
    const t = sim.world.get(station, TraderC)!;
    // Station, civilian: spread only.
    const metal = sim.content.items['item.metal']!.price!; // the base price (8 since the mining economy, #222)
    expect(unitPrice(sim, station, 'item.metal', 'sell')).toBe(Math.round(metal * 1.25));
    expect(unitPrice(sim, station, 'item.metal', 'buy')).toBe(Math.round(metal * 0.6));
    // Trader kind: the liner pays more for food (tag mod) and sells it cheaper.
    t.profile = 'trader.liner';
    expect(unitPrice(sim, station, 'item.ration', 'buy')).toBe(Math.round(5 * 0.6 * 1.25));
    expect(unitPrice(sim, station, 'item.ration', 'sell')).toBe(Math.round(5 * 1.25 * 1.05 * 0.9));
    // Faction: scrappers mark everything up.
    t.profile = 'trader.station';
    t.faction = 'faction.scrapper';
    expect(unitPrice(sim, station, 'item.electronics', 'sell')).toBe(Math.round(16 * 1.25 * 1.3));
    // Unpriced item.
    expect(unitPrice(sim, station, 'item.nothing', 'sell')).toBeNull();
  });

  it('reputation makes friends cheaper to buy from and better to sell to, capped at repMax', () => {
    const { sim, station } = withStation();
    const price = (side: 'sell' | 'buy'): number => unitPrice(sim, station, 'item.electronics', side)!;
    const base = { sell: price('sell'), buy: price('buy') };
    sim.story.reputation['traders'] = 4;
    expect(reputationWith(sim, station)).toBe(4);
    expect(price('sell')).toBeLessThan(base.sell);
    expect(price('buy')).toBeGreaterThan(base.buy);
    expect(price('sell')).toBe(Math.round(16 * 1.25 * (1 - 0.12)));
    sim.story.reputation['traders'] = -4;
    expect(price('sell')).toBeGreaterThan(base.sell);
    expect(price('buy')).toBeLessThan(base.buy);
    sim.story.reputation['traders'] = 1000;
    expect(price('sell')).toBe(Math.round(16 * 1.25 * 0.75));
    sim.story.reputation['traders'] = -1000;
    expect(price('sell')).toBe(Math.round(16 * 1.25 * 1.25));
  });

  it('quotes a balance: get at sell prices minus give at buy prices', () => {
    const { sim, station } = withStation();
    const q = quote(sim, station, [{ item: 'item.electronics', count: 4 }], [{ item: 'item.metal', count: 10 }])!;
    expect(q.getValue).toBe(10 * unitPrice(sim, station, 'item.metal', 'sell')!);
    expect(q.giveValue).toBe(4 * unitPrice(sim, station, 'item.electronics', 'buy')!);
    expect(q.balance).toBe(q.getValue - q.giveValue);
    expect(quote(sim, station, [{ item: 'item.nothing', count: 1 }], [])).toBeNull();
  });
});

describe('hailing', () => {
  it('civilian ships answer; the answer is recorded and announced', () => {
    const { sim, ship } = withCivilian('liner');
    sim.enqueue({ type: 'trade.hail', ship });
    const ev = run(sim, 2);
    expect(ofType(ev, 'trade.hailAnswered')).toEqual([{ type: 'trade.hailAnswered', ship, name: sim.world.get(ship, ShipC)!.name }]);
    expect(sim.trade.hails).toMatchObject([{ ship, answered: true, reason: '' }]);
  });

  it('hostile ships refuse; reputation with their faction can turn a refusal into an answer', () => {
    const sim = newGame(3, content);
    sim.galaxy.fleets = []; // keep NPC traffic out of this long run (fleets arrive in the node every minute)
    sim.enqueue({ type: 'debug.spawnGenerated', faction: 'faction.scrapper', seed: 5, depth: 2, cx: 130, cy: 70 });
    sim.enqueue({ type: 'debug.spawnGenerated', faction: 'faction.drones', seed: 5, depth: 2, cx: 130, cy: 110 });
    sim.step();
    const [pirate, drone] = sim.world.query(ShipC).filter((i) => sim.world.get(i, ShipC)!.faction === 'hostile') as [number, number];
    expect(sim.world.get(pirate, ShipC)!.gen!.faction).toBe('faction.scrapper');
    // Hostile-side ships have their guns on the player at once, so they refuse by command...
    sim.enqueue({ type: 'trade.hail', ship: pirate });
    sim.enqueue({ type: 'trade.hail', ship: drone });
    expect(ofType(run(sim, 2), 'trade.hailRefused').map((e) => e.reason)).toEqual(['weaponsHot', 'weaponsHot']);
    // ...and with the guns off the relation rule decides: faction relation + reputation.
    for (const i of [pirate, drone]) sim.world.get(i, CombatC)!.target = null;
    expect(hailVerdict(sim, pirate)).toMatchObject({ answers: false, reason: 'hostile', score: -2 });
    expect(hailVerdict(sim, drone)).toMatchObject({ answers: false, reason: 'hostile' });
    // The pirate you spared (reputation +2 with 'pirates') would talk; the drones never will.
    sim.story.reputation['pirates'] = 2;
    expect(hailVerdict(sim, pirate)).toMatchObject({ answers: true, score: 0 });
    expect(hailVerdict(sim, drone).answers).toBe(false);
    // Offers need an answered hail.
    sim.enqueue({ type: 'trade.offer', ship: drone, give: [], get: [{ item: 'item.scrap', count: 1 }] });
    expect(rejected(run(sim, 2))).toEqual(['notAnswered']);
  });

  it('bad reputation shuts a friendly faction up, and a ship with its guns on the player refuses', () => {
    const { sim, ship } = withCivilian('freighter');
    sim.story.reputation['traders'] = -3;
    expect(hailVerdict(sim, ship)).toMatchObject({ answers: false, reason: 'hostile' });
    sim.story.reputation['traders'] = 0;
    expect(hailVerdict(sim, ship).answers).toBe(true);
    sim.world.get(ship, CombatC)!.target = { ship: nth(sim, 1), moduleId: 0 };
    expect(hailVerdict(sim, ship)).toMatchObject({ answers: false, reason: 'weaponsHot' });
  });

  it('wrecks stay silent; non-ships are rejected', () => {
    const { sim, ship } = withCivilian('freighter');
    sim.world.get(ship, ShipC)!.state = 'wreck';
    sim.enqueue({ type: 'trade.hail', ship });
    expect(ofType(run(sim, 2), 'trade.hailRefused')[0]?.reason).toBe('silent');
    sim.enqueue({ type: 'trade.hail', ship: 99999 });
    expect(rejected(run(sim, 2))).toEqual(['noTrader']);
  });
});

describe('offers', () => {
  it('validates stock, items, funds, prices and answers', () => {
    const { sim, station } = withStation();
    const offer = (give: { item: string; count: number }[], get: { item: string; count: number }[], barter = false): string[] => {
      sim.enqueue({ type: 'trade.offer', ship: station, give, get, barter });
      return rejected(run(sim, 2));
    };
    expect(offer([], [])).toEqual(['empty']);
    expect(offer([], [{ item: 'item.metal', count: 0 }])).toEqual(['badLine']);
    expect(offer([], [{ item: 'item.nope', count: 1 }])).toEqual(['badLine']);
    expect(offer([], [{ item: 'item.metal', count: 5000 }])).toEqual(['theyLack']);
    expect(offer([{ item: 'item.shuttle', count: 1 }], [])).toEqual(['noItems']);
    sim.enqueue({ type: 'debug.setCredits', value: 3 });
    expect(offer([], [{ item: 'item.metal', count: 10 }])).toEqual(['noFunds']);
    sim.enqueue({ type: 'debug.setCredits', value: 500 });
    expect(offer([], [{ item: 'item.metal', count: 10 }])).toEqual([]);
    expect(sim.trade.offers).toHaveLength(1);
    // A new offer replaces the old one.
    expect(offer([], [{ item: 'item.metal', count: 11 }])).toEqual([]);
    expect(sim.trade.offers).toHaveLength(1);
    expect(sim.trade.offers[0]!.get).toEqual([{ item: 'item.metal', count: 11 }]);
    sim.enqueue({ type: 'trade.cancel', id: sim.trade.offers[0]!.id });
    run(sim, 2);
    expect(sim.trade.offers).toHaveLength(0);
  });

  it('barter balance: item for item, the trader must not lose; the surplus is a gift', () => {
    const { sim, station } = withStation();
    const crate = sim.world.query(StorageC).find((i) => shipIdOf(sim, sim.world.get(i, ModuleC)) === shipIds(sim)[0] as number)!;
    storageAdd(sim, crate, 'item.electronics', 20);
    const start = playerItems(sim, 'item.electronics');
    const offer = (give: number, get: number): { error: string[]; balance?: number } => {
      sim.trade.offers = [];
      sim.enqueue({ type: 'trade.offer', ship: station, give: [{ item: 'item.electronics', count: give }], get: [{ item: 'item.metal', count: get }], barter: true });
      const ev = run(sim, 2);
      return { error: rejected(ev), ...(ofType(ev, 'trade.offered')[0] ? { balance: ofType(ev, 'trade.offered')[0]!.balance } : {}) };
    };
    const metal = unitPrice(sim, station, 'item.metal', 'sell')!;
    const elec = unitPrice(sim, station, 'item.electronics', 'buy')!;
    expect(elec).toBeGreaterThan(0);
    // 2 electronics (2 x 10) buy at most floor(20 / 8) = 2 metal at these prices.
    const ok = Math.floor((2 * elec) / metal);
    expect(offer(2, ok).balance).toBeLessThanOrEqual(0);
    expect(offer(2, ok + 1)).toEqual({ error: ['unbalanced'] });
    // Barter moves no credits.
    const before = sim.trade.credits;
    expect(offer(10, 1).error).toEqual([]);
    sim.enqueue({ type: 'trade.accept', offer: sim.trade.offers[0]!.id });
    // The player's shuttle carries the goods over to the station and back (no instant fallback any more).
    // Step until the deal settles (bounded), not a fixed span: the shuttle trip is the only thing being waited for.
    const ev: SimEvent[] = [];
    for (let i = 0; i < 8000 && ofType(ev, 'trade.settled').length === 0; i++) ev.push(...run(sim, 1));
    ev.push(...run(sim, 100)); // a short tail: nothing is rejected or settled twice afterwards
    expect(rejected(ev)).toEqual([]);
    expect(ofType(ev, 'trade.settled')).toHaveLength(1);
    expect(sim.trade.credits).toBe(before);
    expect(playerItems(sim, 'item.electronics')).toBe(start - 10);
  });
});

describe('trade state', () => {
  it('stock and wallets depend on the world seed and the ship, not on when it is hailed', () => {
    const stockOf = (hailAfter: number): string => {
      const { sim, ship } = withCivilian('freighter');
      run(sim, hailAfter);
      sim.rng.next();
      sim.enqueue({ type: 'trade.hail', ship });
      run(sim, 2);
      const t = sim.world.get(ship, TraderC)!;
      return JSON.stringify([t.credits, t.stock]);
    };
    expect(stockOf(0)).toBe(stockOf(30));
    const other = (() => {
      const { sim, ship } = withCivilian('freighter', 99);
      sim.enqueue({ type: 'trade.hail', ship });
      run(sim, 2);
      return JSON.stringify([sim.world.get(ship, TraderC)!.credits, sim.world.get(ship, TraderC)!.stock]);
    })();
    expect(other).not.toBe(stockOf(0));
  });

  it('the same commands give the same state, and a save round trip keeps hails, offers, deals and wallets', () => {
    const play = (): Sim => {
      const { sim, station } = withStation();
      sim.enqueue({ type: 'trade.offer', ship: station, give: [], get: [{ item: 'item.ration', count: 4 }] });
      run(sim, 2);
      sim.enqueue({ type: 'trade.offer', ship: station, give: [], get: [{ item: 'item.metal', count: 3 }] });
      run(sim, 2);
      sim.enqueue({ type: 'trade.accept', offer: sim.trade.offers[0]!.id });
      run(sim, 10);
      return sim;
    };
    const a = play();
    expect(serialize(a)).toBe(serialize(play()));
    expect(a.trade.deals).toHaveLength(1);
    const b = deserialize(serialize(a), content);
    expect(b.trade).toEqual(a.trade);
    expect(serialize(b)).toBe(serialize(a));
    run(a, 20);
    run(b, 20);
    expect(serialize(b)).toBe(serialize(a));
  });

  it('an old save without trade state loads with none', () => {
    const sim = newGame(2, content);
    sim.galaxy.fleets = []; // keep NPC traffic out of this long run (fleets arrive in the node every minute)
    const raw = JSON.parse(serialize(sim)) as Record<string, unknown>;
    delete raw['trade'];
    const loaded = deserialize(JSON.stringify(raw), content);
    expect(loaded.trade).toEqual({ credits: 0, hails: [], offers: [], deals: [], nextId: 1 });
  });
});
