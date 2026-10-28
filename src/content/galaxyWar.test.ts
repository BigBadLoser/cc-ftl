import { describe, expect, it } from 'vitest';
import {
  ShipC, clash, deserialize, econOf, galaxyIndex, newGame, newsFeed, portOf, portsAt, reportNews, resolveMeetings, serialize, stockAt,
  type Sim,
} from '../sim';
import { atWar } from '../sim/galaxy/clash';
import { encounterKind } from '../sim/galaxy/encounters';
import { nodesWithin, syncFleets } from '../sim/galaxy/fleets';
import { ensureChunk, nodeState } from '../sim/galaxy/state';
import { arrive } from '../sim/galaxy/travel';
import { onTurn } from '../sim/galaxy/turn';
import { NEWS_MAX } from '../sim/galaxy/tuningWar';
import type { Fleet } from '../sim/galaxy/types';
import type { ShipSize } from '../sim/galaxy/defs';
import { content } from '.';

const turns = (sim: Sim, n: number): void => {
  for (let i = 0; i < n; i++) onTurn(sim, ++sim.galaxy.turn);
};
/** Set the clock so the next `onTurn` plays turn `turn`, with every fleet up to date (no catching up). */
function clockAt(sim: Sim, turn: number): void {
  sim.galaxy.turn = turn - 1;
  for (const f of sim.galaxy.fleets) f.synced = turn - 1;
}
/** A world with the player parked in pirate country (a den's node), so pirates, patrols and traders are in the simulated area. Seed 3 has all of them. */
function farWorld(seed = 3): Sim {
  const sim = newGame(seed, content);
  sim.sector.state = 'deploying';
  for (let cy = -5; cy <= 5; cy++) for (let cx = -5; cx <= 5; cx++) ensureChunk(sim, cx, cy);
  const den = [...galaxyIndex(sim.galaxy).nodes.values()].find((n) => portsAt(sim, n.id).some((p) => p.kind === 'den'));
  if (!den) throw new Error('no den');
  sim.galaxy.current = den.id;
  arrive(sim);
  return sim;
}
/** Teleport the player to a node (it drops and waits to deploy), and deploy along the north edge. */
const dropAt = (sim: Sim, node: string): void => {
  sim.enqueue({ type: 'debug.galaxyTeleport', node });
  sim.step();
};
const deploy = (sim: Sim): void => {
  for (let x = 0; x < sim.sector.width && sim.sector.state !== 'active'; x += 4) {
    sim.enqueue({ type: 'sector.deploy', x, y: 2 });
    sim.step();
  }
};
const byRole = (sim: Sim, role: Fleet['role']): Fleet | undefined => sim.galaxy.fleets.find((f) => f.role === role && f.ships.length > 0);

/** Give a fleet ships of these size classes (fresh ids, names and generator keys of its own faction's hulls). */
function ships(sim: Sim, f: Fleet, sizes: ShipSize[], depth = 1): void {
  const proto = f.ships[0]!;
  f.ships = sizes.map((size, i) => ({ ...proto, id: sim.galaxy.nextFleet++, size, depth, seed: proto.seed + i, name: `${proto.name ?? f.role} ${i}` }));
}
/** Park a fleet at a node for good (it takes part in meetings there, and goes nowhere). */
function park(sim: Sim, f: Fleet, node: string): void {
  Object.assign(f, { node, from: node, route: [], dest: node, dwell: 99999, legs: 0, moved: -1, synced: sim.galaxy.turn });
}

interface Scene { sim: Sim; node: string; patrol: Fleet; pirate: Fleet; trader: Fleet }
/**
 * A pirate-country world reduced to a patrol, a pirate and a trader. They meet at a node one hop from the pirate's den, and the player is parked two hops
 * from there (so it is not the player's node, and the pirate has a way home). The trader waits elsewhere unless a test brings it.
 */
function scene(parked = true): Scene {
  for (let seed = 3; seed < 60; seed++) {
    const sim = farWorld(seed);
    // A pirate fleet with a patrol at war with it (the mercenaries are neutral to all, and the cartel to the corporations): the scene is about a fight.
    const pirates = sim.galaxy.fleets.filter((f) => f.role === 'pirate' && f.ships.length > 0);
    const foes = (pirate: Fleet): Fleet | undefined => sim.galaxy.fleets.find((f) => f.role === 'patrol' && f.ships.length > 0 && atWar(sim, f.faction, pirate.faction));
    const pirate = pirates.find((f) => foes(f));
    const patrol = pirate && foes(pirate);
    const trader = byRole(sim, 'trader');
    if (!pirate || !patrol || !trader) continue;
    const den = pirate.home.slice(0, pirate.home.indexOf('#'));
    const node = [...nodesWithin(sim, den, 1)].find(([, d]) => d === 1)?.[0];
    const cur = node && [...nodesWithin(sim, node, 2)].find(([id, d]) => d === 2 && id !== den)?.[0];
    const aside = node && [...nodesWithin(sim, node, 3)].find(([id, d]) => d === 3 && id !== cur)?.[0];
    if (!node || !cur || !aside) continue;
    sim.galaxy.current = cur;
    if (!parked) sim.sector.state = 'active';
    sim.galaxy.fleets = [patrol, pirate, trader];
    park(sim, patrol, node);
    park(sim, pirate, node);
    park(sim, trader, aside);
    return { sim, node, patrol, pirate, trader };
  }
  throw new Error('no world with a patrol, a pirate and a trader');
}
describe('meetings away from the player', () => {
  it('a patrol and a pirate with a lost ship: wrecks, rebuilds and news line up (a seed where the pirate stays to fight)', () => {
    let result = false;
    for (let turn = 1; turn < 60 && !result; turn++) {
      const { sim, node, patrol, pirate } = scene();
      ships(sim, patrol, ['heavy', 'heavy', 'heavy']);
      ships(sim, pirate, ['small']);
      clockAt(sim, turn);
      const name = pirate.ships[0]!.name!;
      onTurn(sim, ++sim.galaxy.turn);
      if (sim.galaxy.fleets.includes(pirate)) continue;
      result = true;
      expect(sim.galaxy.ports[pirate.home]?.queue).toEqual([{ faction: pirate.faction, role: 'pirate', size: 'small' }]);
      expect(nodeState(sim, node).wrecks).toMatchObject([{ name, faction: pirate.faction, turn }]);
      expect(sim.galaxy.news.some((x) => (x.kind === 'destroyed' || x.kind === 'raid') && x.foe === name && x.node === node)).toBe(true);
    }
    expect(result).toBe(true);
  });

  it('the wreck is found on the next drop at that node, once', () => {
    const { sim, node, patrol, pirate } = scene(false);
    ships(sim, patrol, ['heavy', 'heavy', 'heavy']);
    ships(sim, pirate, ['small']);
    // Find a turn where the pirate stays to fight.
    let turn = 0;
    do {
      turn++;
    } while (clash(sim, patrol, pirate, turn).kind === 'avoided');
    clockAt(sim, turn);
    const name = pirate.ships[0]!.name!;
    const shipgen = pirate.ships[0]!.shipgen;
    onTurn(sim, ++sim.galaxy.turn);
    expect(nodeState(sim, node).wrecks?.[0]?.name).toBe(name);
    const wrecksAt = () => sim.world.query(ShipC).filter((id) => sim.world.get(id, ShipC)!.state === 'wreck' && sim.world.get(id, ShipC)!.name === name);
    dropAt(sim, node);
    expect(wrecksAt().length).toBe(1);
    expect(nodeState(sim, node).wrecks).toBeUndefined();
    expect(sim.world.get(wrecksAt()[0]!, ShipC)!.gen?.faction).toBe(shipgen);
    // Deploy, leave and come back: restored from the archive, not duplicated.
    deploy(sim);
    expect(sim.sector.state).toBe('active');
    const away = [...nodesWithin(sim, node, 1)].find(([, d]) => d === 1)![0];
    dropAt(sim, away);
    expect(wrecksAt().length).toBe(0);
    deploy(sim);
    dropAt(sim, node);
    expect(wrecksAt().length).toBe(1);
  }, 60000);

  it('a wreck waiting at a node that was visited before is found on the return', () => {
    const { sim, node } = scene(false);
    // Visit once (archive made), then leave a wreck by an off-screen fight and return.
    const away = [...nodesWithin(sim, node, 1)].find(([, d]) => d === 1)![0];
    dropAt(sim, node);
    deploy(sim);
    dropAt(sim, away);
    nodeState(sim, node).wrecks = [{ shipgen: 'faction.scrapper', seed: 5, depth: 2, name: 'Rust Jackal', faction: 'pirates', turn: 3 }];
    deploy(sim);
    dropAt(sim, node);
    expect(sim.world.query(ShipC).some((id) => sim.world.get(id, ShipC)!.name === 'Rust Jackal' && sim.world.get(id, ShipC)!.state === 'wreck')).toBe(true);
  }, 60000);

  it('a driven-off fleet runs for home, and a patrol that drove off a pirate follows it', () => {
    let seen = 0;
    for (let turn = 1; turn < 400 && seen < 1; turn++) {
      const { sim, node, patrol, pirate } = scene();
      ships(sim, patrol, ['medium']);
      ships(sim, pirate, ['small']);
      clockAt(sim, turn);
      const c = clash(sim, patrol, pirate, turn);
      if (c.kind !== 'driven' || c.winner !== 'a' || c.b.fate !== 'fled') continue;
      onTurn(sim, ++sim.galaxy.turn);
      seen++;
      expect(pirate.ships.length).toBeGreaterThan(0);
      expect(pirate.node === node && pirate.route.length === 0 && pirate.dwell > 1000).toBe(false);
      expect(pirate.dest).toBe(pirate.route.length ? pirate.route[pirate.route.length - 1] : pirate.node);
      expect(patrol.route.length).toBeGreaterThan(0);
      expect(patrol.route[0]).toBe(pirate.node);
    }
    expect(seen).toBe(1);
  });

  it('a bloody draw strands both sides, who call for help', () => {
    let seen = 0;
    for (let turn = 1; turn < 400 && seen < 1; turn++) {
      const { sim, patrol, pirate } = scene();
      ships(sim, patrol, ['small']);
      ships(sim, pirate, ['small']);
      clockAt(sim, turn);
      const c = clash(sim, patrol, pirate, turn);
      if (c.kind !== 'draw' || c.a.lost.length || c.b.lost.length) continue;
      onTurn(sim, ++sim.galaxy.turn);
      seen++;
      expect(patrol.damaged).toBe(true);
      expect(pirate.damaged).toBe(true);
      expect(patrol.dwell).toBeGreaterThan(0);
      expect(encounterKind(sim, patrol)).toBe('distress');
    }
    expect(seen).toBe(1);
  });

  it('a pirate that wins takes the cargo and sells it into the den market at home', () => {
    const run = (cargo: boolean) => {
      for (let turn = 1; turn < 200; turn++) {
        const { sim, node, pirate, trader, patrol } = scene();
        sim.galaxy.fleets = sim.galaxy.fleets.filter((f) => f !== patrol);
        park(sim, trader, node);
        ships(sim, pirate, ['small']);
        ships(sim, trader, ['small']);
        if (cargo) trader.cargo = [{ item: 'item.ration', count: 18 }];
        clockAt(sim, turn);
        const c = clash(sim, pirate, trader, turn);
        if (c.kind !== 'decisive' || c.winner !== 'a') continue;
        const den = portOf(sim, pirate.home)!;
        const e = econOf(sim, den);
        if (!e) continue;
        onTurn(sim, ++sim.galaxy.turn);
        return { sim, node, pirate, den, e, took: pirate.cargo };
      }
      throw new Error('no decisive pirate win');
    };
    const loaded = run(true);
    expect(loaded.took).toEqual([{ item: 'item.ration', count: 18 }]);
    expect(loaded.sim.galaxy.news.some((n) => n.kind === 'loot' && n.item === 'item.ration' && n.count === 18)).toBe(true);
    // It heads home (or rests there) and, docked, the cargo goes into the market.
    const { sim, pirate, e } = loaded;
    pirate.dwell = 0;
    for (let i = 0; i < 40 && (pirate.cargo?.length ?? 0) > 0; i++) turns(sim, 1);
    expect(pirate.cargo).toBeUndefined();
    const twin = run(false);
    // Nothing to take: the lost trader is reported as a trade route cut.
    expect(twin.sim.galaxy.news.some((n) => n.kind === 'cut')).toBe(true);
    expect(twin.sim.galaxy.news.some((n) => n.kind === 'loot')).toBe(false);
    twin.pirate.dwell = 0;
    for (let i = 0; i < 40; i++) turns(twin.sim, 1);
    // Both worlds are on the same turn count only if each ran the same loop; compare at a common turn.
    const at = Math.max(sim.galaxy.turn, twin.sim.galaxy.turn);
    expect(stockAt(sim, e, at)['item.ration']!).toBeGreaterThan(stockAt(twin.sim, twin.e, at)['item.ration']!);
  }, 60000);

  it('the player\'s own node is left to real combat: fleets there (or just gone from there) are never settled by stats', () => {
    const { sim, patrol, pirate } = scene();
    park(sim, patrol, sim.galaxy.current);
    park(sim, pirate, sim.galaxy.current);
    ships(sim, patrol, ['heavy', 'heavy', 'heavy']);
    ships(sim, pirate, ['small']);
    sim.galaxy.turn = 5;
    resolveMeetings(sim, 5, [patrol, pirate]);
    expect(sim.galaxy.fleets.length).toBe(3);
    expect(pirate.ships.length).toBe(1);
    expect(sim.galaxy.news.length).toBe(0);
  });

  it('fleets crossing on a lane in opposite directions meet there; two moving the same way do not', () => {
    const { sim, patrol, pirate, node } = scene();
    const other = [...nodesWithin(sim, node, 1)].find(([, d]) => d === 1)![0];
    ships(sim, patrol, ['heavy', 'heavy', 'heavy']);
    ships(sim, pirate, ['small']);
    const turn = 9;
    sim.galaxy.turn = turn;
    Object.assign(patrol, { from: node, node: other, moved: turn, route: [] });
    Object.assign(pirate, { from: other, node, moved: turn, route: [] });
    // Same direction: no meeting.
    const same = { ...pirate, from: node, node: other } as Fleet;
    resolveMeetings(sim, turn, [patrol, same]);
    expect(sim.galaxy.news.length).toBe(0);
    let fought = false;
    for (let t = turn; t < turn + 30 && !fought; t++) {
      sim.galaxy.news = [];
      Object.assign(patrol, { from: node, node: other, moved: t, ships: patrol.ships });
      Object.assign(pirate, { from: other, node, moved: t });
      resolveMeetings(sim, t, [patrol, pirate]);
      fought = sim.galaxy.news.length > 0 && [node, other].includes(sim.galaxy.news[0]!.node);
    }
    expect(fought).toBe(true);
  });
});

describe('the news log', () => {
  it('is bounded, newest last, and tells nearby news (precise) from distant news (a rumour)', () => {
    const sim = newGame(21, content);
    const near = [...nodesWithin(sim, sim.galaxy.current, 1)].find(([, d]) => d === 1)![0];
    let far = '';
    for (const [id, d] of nodesWithin(sim, sim.galaxy.current, 6)) if (d === 6) far = id;
    expect(far).not.toBe('');
    for (let i = 0; i < NEWS_MAX + 15; i++) reportNews(sim, { kind: 'clash', node: i % 2 ? near : far, who: `A${i}`, faction: 'navy', foe: `B${i}`, foeFaction: 'pirates' });
    expect(sim.galaxy.news.length).toBe(NEWS_MAX);
    expect(sim.galaxy.news[0]!.who).toBe('A15');
    expect(sim.galaxy.news[NEWS_MAX - 1]!.who).toBe(`A${NEWS_MAX + 14}`);
    const feed = newsFeed(sim);
    expect(feed[0]!.item.who).toBe(`A${NEWS_MAX + 14}`);
    expect(feed.find((n) => n.item.node === near)!.precise).toBe(true);
    expect(feed.find((n) => n.item.node === far)!.precise).toBe(false);
  });

  it('a running world makes news (fights, rebuilds, loot), within bounds, and the same news on a replay', () => {
    const run = (): Sim => {
      const sim = farWorld();
      turns(sim, 400);
      return sim;
    };
    const a = run();
    const b = run();
    expect(JSON.stringify(a.galaxy.news)).toBe(JSON.stringify(b.galaxy.news));
    expect(JSON.stringify(a.galaxy.fleets)).toBe(JSON.stringify(b.galaxy.fleets));
    const kinds = new Set(a.galaxy.news.map((n) => n.kind));
    expect(kinds.has('destroyed')).toBe(true);
    expect(kinds.has('rebuilt')).toBe(true);
    expect(a.galaxy.news.length).toBeLessThanOrEqual(NEWS_MAX);
    // The population survives: losses are rebuilt, not a wasteland.
    expect(a.galaxy.fleets.length).toBeGreaterThan(farWorld().galaxy.fleets.length * 0.8);
  }, 60000);

  it('the log and the waiting wrecks survive a save', () => {
    const { sim, node, patrol, pirate } = scene();
    ships(sim, patrol, ['heavy', 'heavy', 'heavy']);
    ships(sim, pirate, ['small']);
    let t = 1;
    while (clash(sim, patrol, pirate, t).kind === 'avoided') t++;
    clockAt(sim, t);
    onTurn(sim, ++sim.galaxy.turn);
    expect(nodeState(sim, node).wrecks?.length).toBeGreaterThan(0);
    const back = deserialize(JSON.parse(JSON.stringify(serialize(sim))), content);
    expect(back.galaxy.news).toEqual(sim.galaxy.news);
    expect(back.galaxy.nodes[node]!.wrecks).toEqual(sim.galaxy.nodes[node]!.wrecks);
  });
});

describe('catching up with meetings', () => {
  it('K turns caught up equal K turns stepped, fights included', () => {
    // A fleet rebuilt inside a catch-up cannot meet within it (documented limit), and with brisker raiding the first rebuild lands around turn 19: compare the window before it.
    const K = 15;
    const a = farWorld();
    turns(a, K);
    const b = farWorld();
    const here = b.galaxy.current;
    b.galaxy.current = '__elsewhere__';
    b.galaxy.turn += K;
    b.galaxy.current = here;
    syncFleets(b, b.galaxy.turn);
    expect(a.galaxy.news.length).toBeGreaterThan(0);
    const strip = (s: Sim) => JSON.stringify(s.galaxy.news.map((n) => ({ ...n, id: 0 })));
    expect(strip(b)).toBe(strip(a));
    const shape = (s: Sim) => JSON.stringify(s.galaxy.fleets.map((f) => [f.id, f.node, f.ships.length, !!f.damaged, f.cargo ?? null]));
    expect(shape(b)).toBe(shape(a));
    expect(JSON.stringify(b.galaxy.ports)).toBe(JSON.stringify(a.galaxy.ports));
    expect(JSON.stringify(b.galaxy.nodes)).toBe(JSON.stringify(a.galaxy.nodes));
  }, 60000);
});
