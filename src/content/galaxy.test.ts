import { describe, expect, it } from 'vitest';
import {
  CombatC, FTL_CHARGE_SEC, SENSOR_HOPS, START_NODE, deserialize, edgeBetween, galaxyIndex, newGame, playerShip, serialize,
  standing, tierOf, type Sim,
} from '../sim';
import { rollArrival } from '../sim/galaxy/arrivals';
import { ensureAround } from '../sim/galaxy/state';
import { enterNode } from '../sim/galaxy/travel';
import { playerStock } from '../sim/story/world';
import { takeItems } from '../sim/story/effects';
import { content } from '.';

const ftl = (sim: Sim) => sim.world.get(playerShip(sim)?.id ?? -1, CombatC);
const fuel = (sim: Sim) => playerStock(sim, 'item.fuel');
const neighbours = (sim: Sim, id: string) => (galaxyIndex(sim.galaxy).adjacent.get(id) ?? []).map((e) => (e.a === id ? e.b : e.a));
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
    expect(Object.values(g.factions).filter((f) => f.kind === 'corporation').length).toBeGreaterThanOrEqual(2);
  });

  it('sets standing tiers from reputation, spillover and base standing', () => {
    const sim = newGame(1, content);
    expect(tierOf(sim, 'pirates')).toBe('hostile');
    expect(tierOf(sim, 'navy')).toBe('neutral');
    expect(tierOf(sim, 'rogue')).toBe('hostile');
    sim.story.reputation['rogue'] = 50;
    expect(tierOf(sim, 'rogue')).toBe('hostile');
    delete sim.story.reputation['rogue'];
    sim.story.reputation['pirates'] = 6;
    expect(tierOf(sim, 'pirates')).toBe('neutral');
    expect(standing(sim, 'navy')).toBeCloseTo(1 - 0.6 * 0.25 * 6);
    sim.story.reputation['navy'] = 4;
    delete sim.story.reputation['pirates'];
    expect(tierOf(sim, 'navy')).toBe('friendly');
  });
});

describe('starmap travel', () => {
  it('starts at the start node with its sensor range discovered and the story context set', () => {
    const sim = newGame(1, content);
    expect(sim.galaxy.current).toBe(START_NODE);
    const h = hops(sim, START_NODE);
    for (const [id, n] of h) expect(sim.galaxy.discovered[id] !== undefined, `${id} at ${n}`).toBe(n <= SENSOR_HOPS);
    expect(sim.story.context).toMatchObject({ danger: 0, faction: 'navy' });
    expect(fuel(sim)).toBe(16);
  });

  it('jumps along an edge, spending its fuel and FTL charge, and widens discovery', () => {
    const sim = newGame(2, content);
    const to = neighbours(sim, START_NODE)[0] as string;
    const edge = edgeBetween(sim.galaxy, START_NODE, to);
    sim.enqueue({ type: 'galaxy.jump', to });
    sim.step();
    expect(rejections(sim)).toEqual(['notCharged']);
    sim.enqueue({ type: 'debug.chargeFtl' });
    sim.enqueue({ type: 'galaxy.jump', to });
    sim.step();
    expect(sim.galaxy.current).toBe(to);
    expect(fuel(sim)).toBe(16 - (edge?.fuel ?? 0));
    expect(ftl(sim)?.ftl).toBeCloseTo(FTL_CHARGE_SEC - (edge?.charge ?? 0), 0);
    expect(sim.galaxy.visited[to]).toBeDefined();
    for (const [id, n] of hops(sim, to)) if (n <= SENSOR_HOPS) expect(sim.galaxy.discovered[id], id).toBeDefined();
  });

  it('refuses jumps without an edge or without fuel', () => {
    const sim = newGame(3, content);
    sim.enqueue({ type: 'debug.chargeFtl' });
    const far = [...hops(sim, START_NODE)].find(([, n]) => n === 2)?.[0] as string;
    sim.enqueue({ type: 'galaxy.jump', to: far });
    sim.step();
    expect(rejections(sim)).toEqual(['noRoute']);
    takeItems(sim, 'item.fuel', fuel(sim));
    const to = neighbours(sim, START_NODE)[0] as string;
    sim.enqueue({ type: 'galaxy.jump', to });
    sim.step();
    expect(rejections(sim)).toEqual(['noFuel']);
    expect(sim.galaxy.current).toBe(START_NODE);
  });

  it('rolls arrivals deterministically, never at danger 0, and spawns them by the gap rule', () => {
    const calm = newGame(4, content);
    for (let t = 0; t < 40; t++) {
      calm.tick = calm.galaxy.nextArrival;
      rollArrival(calm);
    }
    expect(Object.values(calm.galaxy.nodes).flatMap((s) => s.contacts).filter((c) => c.since > 0)).toEqual([]);

    const run = () => {
      const sim = newGame(4, content);
      // Teleport to a danger 6+ node (a debug move: no jump) and stay a while.
      ensureAround(sim, 's.12.0.n0');
      const far = [...galaxyIndex(sim.galaxy).nodes.values()].filter((n) => n.danger >= 6).sort((a, b) => (a.id < b.id ? -1 : 1))[0];
      if (!far) throw new Error('no far node');
      sim.galaxy.current = far.id;
      enterNode(sim, far.id, null);
      const arrived: string[] = [];
      for (let t = 0; t < 30; t++) {
        sim.tick = sim.galaxy.nextArrival;
        rollArrival(sim);
        for (const e of sim.events.drain()) if (e.type === 'galaxy.enemyArrived') arrived.push(`${t}:${e.faction}:${e.ship ?? '-'}`);
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
    sim.enqueue({ type: 'galaxy.jump', to: neighbours(sim, START_NODE)[0] as string });
    sim.step();
    const json = serialize(sim);
    expect(JSON.parse(json).galaxy.chunks).toEqual(Object.keys(sim.galaxy.chunks).sort());
    const back = deserialize(json, content);
    expect(back.galaxy.current).toBe(sim.galaxy.current);
    const sorted = (c: Record<string, unknown>) => JSON.stringify(Object.keys(c).sort().map((k) => c[k]));
    expect(sorted(back.galaxy.chunks)).toBe(sorted(sim.galaxy.chunks));
    expect(serialize(back)).toBe(json);
  });
});
