import { describe, expect, it } from 'vitest';
import {
  CombatC, FTL_CHARGE_SEC, SENSOR_HOPS, START_NODE, deserialize, edgeBetween, galaxyIndex, newGame, playerShip, serialize,
  standing, tierOf, type Sim,
} from '../sim';
import { GENERATOR_VERSION } from '../sim/galaxy/tuning';
import { SCAVENGER_CHANCE, SCAVENGER_FACTION } from '../sim/galaxy/tuningHeat';
import { galaxySystem } from '../sim/systems/galaxy';
import { rollArrival } from '../sim/galaxy/arrivals';
import { ensureAround } from '../sim/galaxy/state';
import { playerStock } from '../sim/story/world';
import { takeItems } from '../sim/story/effects';
import { content } from '.';

const ftl = (sim: Sim) => sim.world.get(playerShip(sim), CombatC);
const fuel = (sim: Sim) => playerStock(sim, 'item.fuel');
const neighbours = (sim: Sim, id: string) => (galaxyIndex(sim.galaxy).adjacent.get(id) ?? []).map((e) => (e.a === id ? e.b : e.a));
/** Queue a jump of the player's ship. */
const jumpTo = (sim: Sim, ...route: string[]) => sim.enqueue({ type: 'galaxy.jump', ship: playerShip(sim), route });
/** Run a trip to its last node and drop out of hyperspace. */
const land = (sim: Sim) => {
  sim.step();
  for (let i = 0; i < 20000 && sim.sector.state === 'hyperspace' && (sim.galaxy.travel?.phase === 'hop' || sim.galaxy.travel?.phase === 'story'); i++) { sim.step(); sim.story.active = null; }
  sim.enqueue({ type: 'galaxy.drop' });
  sim.step();
};
/** Place the waiting ship in the middle of the sector (the deploy modal's job). */
const deploy = (sim: Sim) => {
  // A node's structures stand east of x = 70 (galaxy/populate.ts): fall back to the free water in the west.
  for (const [x, y] of [[100, 60], [20, 50]] as const) {
    sim.enqueue({ type: 'sector.deploy', x, y });
    sim.step();
    if (sim.sector.state === 'active') break;
  }
};
const rejections = (sim: Sim) => sim.events.drain().filter((e) => e.type === 'command.rejected').map((e) => (e as { reason: string }).reason);

/** Hops from `from` to every node, over the generated graph. */
function hops(sim: Sim, from: string): Map<string, number> {
  const out = new Map([[from, 0]]);
  let frontier = [from];
  for (let h = 1; frontier.length; h++) {
    const next: string[] = [];
    for (const n of frontier) for (const m of neighbours(sim, n)) {
      if (out.has(m)) continue;
      out.set(m, h);
      next.push(m);
    }
    frontier = next;
  }
  return out;
}

describe('galaxy content', () => {
  it('references real generator factions, structures and factions', () => {
    const g = content.galaxy;
    for (const [id, f] of Object.entries(g.factions)) {
      for (const s of f.ships) expect(content.factions[s.value as keyof typeof content.factions], `${id} ${s.value}`).toBeDefined();
      for (const s of 'stations' in f ? f.stations : []) expect(g.structures[s.value as keyof typeof g.structures], s.value).toBeDefined();
      for (const r of Object.keys('relations' in f ? f.relations : {})) expect(g.factions[r as keyof typeof g.factions], r).toBeDefined();
    }
    for (const s of Object.values(g.structures)) for (const item of s.resources) expect(content.items[item as keyof typeof content.items], item).toBeDefined();
    // One faction table: every galaxy faction names a reputation key trade also uses.
    const tradeKeys = new Set(Object.values(content.trade.factions).map((f) => f.reputation));
    for (const [id, f] of Object.entries(g.factions)) expect(tradeKeys.has(f.reputation), `${id} ${f.reputation}`).toBe(true);
    expect(Object.values(g.factions).filter((f) => f.kind === 'corporation').length).toBeGreaterThanOrEqual(2);
  });

  it('sets standing tiers from reputation, spillover and base standing', () => {
    const sim = newGame(1, content);
    expect(tierOf(sim, 'pirates')).toBe('hostile');
    expect(tierOf(sim, 'navy')).toBe('neutral');
    expect(tierOf(sim, 'rogue')).toBe('hostile');
    sim.story.reputation['drones'] = 50;
    expect(tierOf(sim, 'rogue')).toBe('hostile');
    delete sim.story.reputation['drones'];
    sim.story.reputation['pirates'] = 6;
    expect(tierOf(sim, 'pirates')).toBe('neutral');
    expect(standing(sim, 'navy')).toBeCloseTo(1 - 0.6 * 0.25 * 6);
    sim.story.reputation['navy'] = 4;
    delete sim.story.reputation['pirates'];
    expect(tierOf(sim, 'navy')).toBe('friendly');
  });
});

describe('starmap travel', () => {
  it('starts at the start node with its sector and sensor range discovered and the story context set', () => {
    const sim = newGame(1, content);
    expect(sim.galaxy.current).toBe(START_NODE);
    const h = hops(sim, START_NODE);
    const sector = galaxyIndex(sim.galaxy).nodes.get(START_NODE)?.sector;
    for (const [id, n] of h) {
      const inSector = galaxyIndex(sim.galaxy).nodes.get(id)?.sector === sector;
      expect(sim.galaxy.discovered[id] !== undefined, `${id} at ${n}`).toBe(n <= SENSOR_HOPS || inSector);
    }
    expect(sim.story.context).toMatchObject({ danger: 0, faction: 'navy' });
    expect(fuel(sim)).toBe(16);
  });

  it('jumps along an edge, spending its fuel and FTL charge, and widens discovery', () => {
    const sim = newGame(2, content);
    const to = neighbours(sim, START_NODE)[0] as string;
    const edge = edgeBetween(sim.galaxy, START_NODE, to);
    jumpTo(sim, to);
    sim.step();
    expect(rejections(sim)).toEqual(['notCharged']);
    sim.enqueue({ type: 'debug.chargeFtl' });
    jumpTo(sim, to);
    sim.step();
    // In hyperspace: the ship is lifted out, nothing has been passed yet.
    expect(sim.sector.state).toBe('hyperspace');
    expect(sim.galaxy.current).toBe(START_NODE);
    land(sim);
    expect(sim.galaxy.current).toBe(to);
    expect(sim.sector).toMatchObject({ node: to, state: 'deploying' });
    deploy(sim);
    expect(fuel(sim)).toBe(16 - (edge?.fuel ?? 0));
    expect(ftl(sim)?.ftl).toBeCloseTo(FTL_CHARGE_SEC - (edge?.charge ?? 0), 0);
    expect(sim.galaxy.visited[to]).toBeDefined();
    for (const [id, n] of hops(sim, to)) if (n <= SENSOR_HOPS) expect(sim.galaxy.discovered[id], id).toBeDefined();
  });

  it('refuses jumps without an edge or without fuel', () => {
    const sim = newGame(3, content);
    sim.enqueue({ type: 'debug.chargeFtl' });
    const far = [...hops(sim, START_NODE)].find(([, n]) => n === 2)?.[0] as string;
    jumpTo(sim, far);
    sim.step();
    expect(rejections(sim)).toEqual(['noRoute']);
    takeItems(sim, 'item.fuel', fuel(sim));
    const to = neighbours(sim, START_NODE)[0] as string;
    jumpTo(sim, to);
    sim.step();
    expect(rejections(sim)).toEqual(['noFuel']);
    expect(sim.galaxy.current).toBe(START_NODE);
  });

  it('rolls arrivals deterministically, only the odd lone scavenger at danger 0, and spawns them by the gap rule', () => {
    const calm = newGame(4, content);
    for (let t = 0; t < 40; t++) {
      calm.tick = calm.galaxy.nextArrival;
      rollArrival(calm);
    }
    // Near the start nobody hostile is in the traffic pool: only scavengers (SCAVENGER_CHANCE a roll), never more than the arrival cap.
    const came = Object.values(calm.galaxy.nodes).flatMap((s) => s.contacts).filter((c) => c.since > 0);
    expect(came.every((c) => c.faction === SCAVENGER_FACTION && c.depth === 0)).toBe(true);
    expect(came.length).toBeLessThanOrEqual(Math.ceil(40 * SCAVENGER_CHANCE * 3));

    const run = () => {
      const sim = newGame(4, content);
      // Teleport to a danger 6+ node (a debug move: no jump) and stay a while.
      ensureAround(sim, 's.12.0.n0');
      const far = [...galaxyIndex(sim.galaxy).nodes.values()].filter((n) => n.danger >= 6).sort((a, b) => (a.id < b.id ? -1 : 1))[0];
      if (!far) throw new Error('no far node');
      sim.enqueue({ type: 'debug.galaxyTeleport', node: far.id });
      sim.step();
      deploy(sim);
      sim.events.drain();
      const arrived: string[] = [];
      for (let t = 0; t < 30; t++) {
        sim.tick = sim.galaxy.nextArrival;
        rollArrival(sim);
        for (const e of sim.events.drain()) if (e.type === 'galaxy.shipArrived') arrived.push(`${t}:${e.faction}:${e.ship ?? '-'}`);
      }
      return arrived;
    };
    const a = run();
    expect(a.some((s) => !s.endsWith(':-'))).toBe(true);
    expect(run()).toEqual(a);
  }, 60000);

  it('saves and loads the galaxy, regenerating its chunks', () => {
    const sim = newGame(5, content);
    sim.enqueue({ type: 'debug.chargeFtl' });
    jumpTo(sim, neighbours(sim, START_NODE)[0] as string);
    for (let i = 0; i < 40; i++) sim.step(); // a trip still under way
    expect(sim.sector.state).toBe('hyperspace');
    const json = serialize(sim);
    expect(JSON.parse(json).galaxy.chunks).toEqual(Object.keys(sim.galaxy.chunks).sort());
    const back = deserialize(json, content);
    expect(back.galaxy.current).toBe(sim.galaxy.current);
    const sorted = (c: Record<string, unknown>) => JSON.stringify(Object.keys(c).sort().map((k) => c[k]));
    expect(sorted(back.galaxy.chunks)).toBe(sorted(sim.galaxy.chunks));
    expect(serialize(back)).toBe(json);
  });

  it('refuses a save made under another generator version', () => {
    const json = serialize(newGame(6, content));
    const data = JSON.parse(json);
    expect(data.galaxy.generatorVersion).toBe(GENERATOR_VERSION);
    data.galaxy.generatorVersion = GENERATOR_VERSION + 1;
    expect(() => deserialize(JSON.stringify(data), content)).toThrow(/generator version/);
  });

  it('does not jump, spawn arrivals or run its system while the sector is deploying', () => {
    const sim = newGame(7, content);
    const far = [...galaxyIndex(sim.galaxy).nodes.values()].find((n) => n.danger >= 3);
    if (!far) throw new Error('no dangerous node');
    sim.galaxy.current = far.id;
    sim.sector.state = 'deploying';
    sim.tick = sim.galaxy.nextArrival;
    const rng = sim.galaxy.rng;
    for (let i = 0; i < 20; i++) galaxySystem(sim);
    rollArrival(sim);
    expect(sim.galaxy.rng).toBe(rng);
    expect(sim.events.drain().filter((e) => e.type === 'galaxy.shipArrived')).toEqual([]);
    sim.enqueue({ type: 'debug.chargeFtl' });
    jumpTo(sim, neighbours(sim, far.id)[0] as string);
    sim.step();
    expect(rejections(sim)).toEqual(['deploying']);
    expect(sim.galaxy.current).toBe(far.id);
  });
});
