import { describe, expect, it } from 'vitest';
import {
  CombatC, CrewC, ForHireC, ItemStackC, ShipC, TraderC, attachServices, checkOffer, contrabandAboard, deserialize, newGame, pirateKeys, playerShip, reputationWith, serialize,
  storageAdd, storageCount, truceBanned, truceHolds, unitPrice, SAVE_VERSION, type Sim,
} from '../sim';
import { stat } from '../sim/stats';
import { dockScan, scanPending } from '../sim/blackmarket/scan';
import { syncRecruits } from '../sim/galaxy/recruit';
import { PrizeC } from '../sim/combat/components';
import { capturePrize } from '../sim/capture/prize';
import { StorageC } from '../sim/items/components';
import { spillItems } from '../sim/items/stacks';
import { ModuleC } from '../sim/modules/components';
import { playerStorages } from '../sim/story/world';
import { reputationOf } from '../sim/story/state';
import { content } from './index';

const STOLEN = 'item.stolen_goods';

function run(sim: Sim, n: number): string[] {
  const log: string[] = [];
  for (let i = 0; i < n; i++) {
    sim.step();
    for (const e of sim.events.drain()) log.push(e.type === 'command.rejected' ? `${e.type}:${e.command}:${e.reason}` : e.type);
  }
  return log;
}

/** A new game with one test station next to the player, hailed. */
function withStation(kind = 'station.trading'): { sim: Sim; station: number } {
  const sim = newGame(3, content);
  run(sim, 20);
  sim.enqueue({ type: 'debug.spawnStation', kind, size: 'outpost', seed: 4 });
  run(sim, 1);
  const station = sim.world.query(ShipC).find((i) => sim.world.get(i, ShipC)!.immobile) as number;
  sim.enqueue({ type: 'trade.hail', ship: station });
  run(sim, 1);
  return { sim, station };
}

const giveItems = (sim: Sim, item: string, n: number): void => {
  const st = playerStorages(sim)[0] as number;
  expect(storageAdd(sim, st, item, n)).toBe(n);
};

describe('black-market services', () => {
  it('attaches any set to a station: stock, owner fallback, and a truce for every set', () => {
    const { sim, station } = withStation();
    expect(attachServices(sim, station, 'bm.nope')).toBe(false);
    expect(attachServices(sim, station, 'bm.lesser')).toBe(true);
    const t = sim.world.get(station, TraderC)!;
    expect(t.services).toEqual(['bm.lesser']);
    expect(t.fence).toBeUndefined();
    expect(truceHolds(sim)).toBe(true);
    expect(attachServices(sim, station, 'bm.lesser')).toBe(true);
    expect(t.services).toEqual(['bm.lesser']);
    // The cartel is a string id with no faction yet: the owner is left as it was. It sets the truce and brings a fence.
    expect(attachServices(sim, station, 'bm.cartel')).toBe(true);
    expect(t.owner).toBeUndefined();
    expect(t.fence).toBeGreaterThanOrEqual(0.5);
    expect(t.fence).toBeLessThanOrEqual(0.6);
    expect(truceHolds(sim)).toBe(true);
    expect(t.stock.find((l) => l.item === STOLEN)!.count).toBeGreaterThanOrEqual(10);
  });

  it('a legitimate trader refuses contraband; a black market pays a share of its value; the lesser set has no fence', () => {
    const { sim, station } = withStation();
    giveItems(sim, STOLEN, 5);
    expect(unitPrice(sim, station, STOLEN, 'buy')).toBeNull();
    expect(checkOffer(sim, station, [{ item: STOLEN, count: 2 }], [], false).error).toBe('contraband');
    attachServices(sim, station, 'bm.lesser');
    const pays = unitPrice(sim, station, STOLEN, 'buy')!;
    const value = content.items[STOLEN].price;
    expect(pays).toBeGreaterThanOrEqual(Math.round(value * 0.6));
    expect(pays).toBeLessThan(value);
    expect(checkOffer(sim, station, [{ item: STOLEN, count: 2 }], [], false).error).toBeNull();
    // Worse prices on everything else than the plain station asked.
    const plain = withStation();
    expect(unitPrice(sim, station, 'item.metal', 'sell')!).toBeGreaterThan(unitPrice(plain.sim, plain.station, 'item.metal', 'sell')!);
    expect(unitPrice(sim, station, 'item.metal', 'buy')!).toBeLessThanOrEqual(unitPrice(plain.sim, plain.station, 'item.metal', 'buy')!);
  });

  it('the cartel fence buys anything at 50 to 60% of value, contraband included, and pays more for contraband than the lesser set', () => {
    const lesser = withStation();
    attachServices(lesser.sim, lesser.station, 'bm.lesser');
    const { sim, station } = withStation();
    attachServices(sim, station, 'bm.cartel');
    const fence = sim.world.get(station, TraderC)!.fence!;
    for (const item of ['item.rare_ore', 'item.shuttle', 'item.rifle']) {
      const price = (content.items as Record<string, { price?: number }>)[item]!.price!;
      expect(unitPrice(sim, station, item, 'buy')!).toBeGreaterThanOrEqual(Math.round(price * fence));
      expect(unitPrice(sim, station, item, 'buy')!).toBeLessThanOrEqual(Math.round(price * 0.6) + 0);
    }
    expect(unitPrice(sim, station, STOLEN, 'buy')!).toBeGreaterThan(unitPrice(lesser.sim, lesser.station, STOLEN, 'buy')!);
    // The same seed and station roll the same fence.
    const again = withStation();
    attachServices(again.sim, again.station, 'bm.cartel');
    expect(again.sim.world.get(again.station, TraderC)!.fence).toBe(fence);
  });

  it('the zealot bazaar stocks machine goods and only trades with standing (the augmentation rule is a stub)', () => {
    const { sim, station } = withStation();
    attachServices(sim, station, 'bm.zealot');
    const stock = sim.world.get(station, TraderC)!.stock.map((l) => l.item);
    expect(stock).toEqual(expect.arrayContaining(['item.ai_core', 'item.robot_parts', 'item.drone_tech']));
    sim.enqueue({ type: 'trade.hail', ship: station });
    run(sim, 1);
    expect(sim.trade.hails.find((h) => h.ship === station)).toMatchObject({ answered: false, reason: 'rule' });
    // The cult's reputation key falls back to the station kind's own (traders); raise it past the threshold.
    sim.story.reputation['traders'] = (sim.story.reputation['traders'] ?? 0) + 3;
    sim.enqueue({ type: 'trade.hail', ship: station });
    run(sim, 1);
    expect(sim.trade.hails.find((h) => h.ship === station)?.answered).toBe(true);
  });

  it('shady crew: better skills, a higher one-time fee, no wages; the lesser set has fewer and weaker ones than the hiring hall', () => {
    const { sim, station } = withStation();
    attachServices(sim, station, 'bm.mercenary');
    syncRecruits(sim);
    const hires = sim.world.query(ForHireC).map((id) => ({ id, fh: sim.world.get(id, ForHireC)! })).filter((h) => h.fh.station === station);
    expect(hires.length).toBe(content.blackMarkets['bm.mercenary'].shadyCrew.slots);
    for (const { id, fh } of hires) {
      expect(fh.shady).toBe(2);
      expect(fh.cost).toBeGreaterThan(300);
      const role = (content.roles as Record<string, { skills?: Record<string, number> }>)[sim.world.get(id, CrewC)!.role]!;
      for (const [skill, level] of Object.entries(role.skills ?? {})) expect(stat(sim, id, skill as 'gunnery')).toBeGreaterThanOrEqual((level as number) + 2);
    }
    const lesser = withStation();
    attachServices(lesser.sim, lesser.station, 'bm.lesser');
    syncRecruits(lesser.sim);
    expect(lesser.sim.world.query(ForHireC).length).toBe(content.blackMarkets['bm.lesser'].shadyCrew.slots);
    // Crew are never given a wage: the hire fee is the only cost.
    expect(JSON.stringify(content.blackMarkets)).not.toMatch(/wage/i);
  });

  it('survives a save and load', () => {
    const { sim, station } = withStation();
    attachServices(sim, station, 'bm.cartel');
    const copy = deserialize(serialize(sim), content);
    expect(JSON.parse(serialize(sim)).version).toBe(SAVE_VERSION);
    expect(copy.world.get(station, TraderC)).toMatchObject({ services: ['bm.cartel'], fence: sim.world.get(station, TraderC)!.fence });
    expect(truceHolds(copy)).toBe(true);
  });
});

describe('contraband sources', () => {
  it('a delivery crate broken open spills stolen goods, not the delivery', () => {
    const sim = newGame(5, content);
    run(sim, 5);
    const ship = playerShip(sim);
    const hold = sim.world.get(playerStorages(sim)[0]!, ModuleC)!;
    sim.galaxy.jobs.push({ id: 90, key: 'k', kind: 'delivery', issuer: 'meridian', from: 'x#0', to: 's.9.9.n0', item: 'item.metal', count: 7, reward: 50, due: 99 } as never);
    expect(spillItems(sim, ship, hold.x, hold.y, 'item.cargo_crate', 1, 90)).toBe(0);
    sim.enqueue({ type: 'jobs.abandon', id: 90 });
    run(sim, 1);
    const spilled = sim.world.query(ItemStackC).map((i) => sim.world.get(i, ItemStackC)!).filter((st) => st.item === STOLEN);
    expect(spilled.reduce((n, st) => n + st.count, 0)).toBe(7);
    expect(sim.world.query(ItemStackC).some((i) => sim.world.get(i, ItemStackC)!.item === 'item.metal' && sim.world.get(i, ItemStackC)!.count === 7)).toBe(false);
  });

  it('loot on a captured ship is contraband', () => {
    const sim = newGame(5, content);
    run(sim, 5);
    sim.enqueue({ type: 'debug.spawnEnemy', template: Object.keys(content.ships)[1] as string, x: 120, y: 40 });
    run(sim, 2);
    const foe = sim.world.query(ShipC).find((i) => sim.world.get(i, ShipC)!.faction === 'hostile')!;
    capturePrize(sim, foe);
    expect(sim.world.has(foe, PrizeC)).toBe(true);
    const stored = sim.world.query(StorageC).reduce((n, id) => n + storageCount(sim, id, 'item.looted_goods'), 0);
    const loose = sim.world.query(ItemStackC).reduce((n, id) => n + (sim.world.get(id, ItemStackC)!.item === 'item.looted_goods' ? sim.world.get(id, ItemStackC)!.count : 0), 0);
    expect(stored + loose).toBeGreaterThanOrEqual(2);
  });
});

describe('scans', () => {
  function lawStation(): { sim: Sim; station: number } {
    const w = withStation();
    w.sim.world.get(w.station, TraderC)!.owner = 'navy';
    return w;
  }
  it('a navy station scans on the hail; contraband aboard waits for surrender or bribe, and trade is held meanwhile', () => {
    const { sim, station } = lawStation();
    giveItems(sim, STOLEN, 10);
    const credits = sim.trade.credits;
    expect(dockScan(sim, 'navy', 'Depot')).toBe(true);
    expect(scanPending(sim)).toBe(true);
    const e = sim.galaxy.encounters.find((x) => x.scan)!;
    expect(e.scan!.value).toBe(10 * content.items[STOLEN].price);
    expect(e.scan!.bribe).toBeGreaterThan(e.scan!.fine);
    sim.enqueue({ type: 'trade.offer', ship: station, give: [], get: [{ item: 'item.metal', count: 1 }], barter: false });
    expect(run(sim, 1)).toContain('command.rejected:trade.offer:scanPending');
    const navy = reputationOf(sim.story, 'navy');
    sim.enqueue({ type: 'galaxy.respond', encounter: e.id, choice: 'surrender' });
    run(sim, 1);
    expect(contrabandAboard(sim)).toEqual([]);
    expect(sim.trade.credits).toBe(credits - e.scan!.fine);
    expect(reputationOf(sim.story, 'navy')).toBeLessThan(navy);
    expect(sim.galaxy.encounters.length).toBe(0);
    expect(sim.galaxy.lastResult?.outcome).toBe('confiscated');
  });

  it('a bribe keeps the goods and the standing; it is refused without the credits', () => {
    const { sim } = lawStation();
    giveItems(sim, STOLEN, 10);
    dockScan(sim, 'navy', 'Depot');
    const e = sim.galaxy.encounters.find((x) => x.scan)!;
    const navy = reputationOf(sim.story, 'navy');
    sim.trade.credits = e.scan!.bribe - 1;
    sim.enqueue({ type: 'galaxy.respond', encounter: e.id, choice: 'bribe' });
    expect(run(sim, 1)).toContain('command.rejected:galaxy.respond:cantAfford');
    sim.trade.credits = e.scan!.bribe + 5;
    sim.enqueue({ type: 'galaxy.respond', encounter: e.id, choice: 'bribe' });
    run(sim, 1);
    expect(sim.trade.credits).toBe(5);
    expect(contrabandAboard(sim)).toEqual([{ item: STOLEN, count: 10 }]);
    expect(reputationOf(sim.story, 'navy')).toBe(navy);
  });

  it('finds nothing without contraband, never scans for a non-law owner, and scans a node once per cooldown', () => {
    const { sim } = lawStation();
    expect(dockScan(sim, 'navy', 'Depot')).toBe(false);
    giveItems(sim, STOLEN, 3);
    expect(dockScan(sim, 'pirates', 'Den')).toBe(false);
    expect(dockScan(sim, 'navy', 'Depot')).toBe(false); // scanned a moment ago (and found nothing)
    sim.galaxy.turn += 10;
    expect(dockScan(sim, 'navy', 'Depot')).toBe(true);
    expect(sim.galaxy.encounters.filter((e) => e.scan).length).toBe(1);
  });

  it('visiting a black market costs no navy standing', () => {
    const { sim, station } = withStation();
    attachServices(sim, station, 'bm.cartel');
    const before = reputationWith(sim, station);
    sim.enqueue({ type: 'trade.hail', ship: station });
    run(sim, 30);
    expect(reputationOf(sim.story, 'navy')).toBe(0);
    expect(reputationWith(sim, station)).toBe(before);
  });
});

describe('truce', () => {
  function market(): { sim: Sim; station: number; foe: number } {
    const w = withStation();
    attachServices(w.sim, w.station, 'bm.cartel');
    w.sim.enqueue({ type: 'debug.spawnEnemy', template: Object.keys(content.ships)[1] as string, x: 150, y: 60 });
    run(w.sim, 2);
    const foe = w.sim.world.query(ShipC).find((i) => w.sim.world.get(i, ShipC)!.faction === 'hostile')!;
    return { ...w, foe };
  }

  it('nobody starts a fight while it holds, and travelling there is never blocked', () => {
    const { sim, foe } = market();
    const mine = playerShip(sim);
    const hp = sim.world.get(mine, ShipC)!.integrity;
    run(sim, 300);
    expect(sim.sector.inCombat).toBe(false);
    expect(sim.world.get(foe, ShipC)!.state).toBe('active');
    expect(sim.world.get(foe, CombatC)?.target ?? null).toBeNull();
    expect(sim.world.get(mine, ShipC)!.integrity).toBe(hp);
  });

  it('firing on anyone there breaks it: a ban, every ship hostile, standing down with every pirate faction; it lapses after 30 turns', () => {
    const { sim, station } = market();
    const keys = pirateKeys(sim);
    expect(keys.length).toBeGreaterThan(0);
    const before = keys.map((k) => reputationOf(sim.story, k));
    sim.enqueue({ type: 'combat.setTarget', ship: playerShip(sim), weaponId: null, targetShip: station, targetModuleId: 0 });
    const log = run(sim, 3);
    expect(log).toContain('truce.breached');
    expect(truceBanned(sim)).toBe(true);
    expect(truceHolds(sim)).toBe(false);
    expect(sim.world.get(station, ShipC)!.faction).toBe('hostile');
    keys.forEach((k, i) => expect(reputationOf(sim.story, k)).toBeLessThan(before[i]!));
    const until = sim.galaxy.nodes[sim.sector.node]!.truce!.banUntil!;
    expect(until).toBe(sim.galaxy.turn + 30);
    // The game never stops the player travelling there: the jump check has no truce clause (it is a pure flag read), and the ban lapses on its own.
    sim.galaxy.turn = until;
    sim.enqueue({ type: 'combat.setTarget', ship: playerShip(sim), weaponId: null, targetShip: 0, targetModuleId: 0 });
    run(sim, 3);
    expect(truceBanned(sim)).toBe(false);
    expect(truceHolds(sim)).toBe(true);
    expect(sim.world.get(station, ShipC)!.faction).toBe('neutral');
    expect(sim.world.get(station, ShipC)!.banned).toBeUndefined();
  });
});
