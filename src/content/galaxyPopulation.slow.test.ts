import { describe, expect, it } from 'vitest';
import { galaxyIndex, newGame, portOf, previewHull, type GalaxyContent, type Sim } from '../sim';
import { syncFleets } from '../sim/galaxy/fleets';
import { portNode } from '../sim/galaxy/ports';
import { CATCHUP_MAX } from '../sim/galaxy/tuning';
import { onTurn } from '../sim/galaxy/turn';
import { content } from '.';

const galaxy: GalaxyContent = content.galaxy;

/** A parked game (fleets stay data) with the map revealed `radius` chunks around the start, so every kind of port exists. */
function world(seed: number, radius: number): Sim {
  const sim = newGame(seed, content);
  sim.enqueue({ type: 'debug.galaxyReveal', radius });
  sim.step();
  sim.sector.state = 'deploying';
  return sim;
}

describe('the population over many seeds', () => {
  it('every kind of port fields its role; budgets, caps and size classes hold across hundreds of fleets', () => {
    const roleOf = { den: 'pirate', depot: 'patrol', outpost: 'miner', nest: 'raider' } as const;
    const kinds = new Set<string>();
    const pirates = [0, 0];
    let ships = 0;
    let classed = 0;
    const cost = galaxy.fleet.sizeCost;
    // The fixed seeds 31 to 50. A seed whose near map holds no pirate fleet says nothing about pirates, so it is skipped; at least MIN_PIRATE_WORLDS must qualify.
    const MIN_PIRATE_WORLDS = 4;
    let withDens = 0;
    for (let seed = 31; seed <= 50; seed++) {
      const sim = world(seed, 2);
      if (!sim.galaxy.fleets.some((f) => f.role === 'pirate')) continue;
      withDens++;
      for (const f of sim.galaxy.fleets) {
        const port = portOf(sim, f.home)!;
        kinds.add(port.kind);
        if (port.kind !== 'station') expect(f.role).toBe(roleOf[port.kind]);
        const def = galaxy.factions[f.faction]?.fleet?.groups[f.role];
        expect(def).toBeDefined();
        expect(f.ships.length).toBeLessThanOrEqual(def?.maxShips ?? 0);
        if (f.ships.length > 1) expect(f.ships.reduce((n, c) => n + cost[c.size ?? 'small'], 0)).toBeLessThanOrEqual(Math.max(...(def?.budget ?? []).map((b) => b.value)));
        if (f.role === 'trader' || f.role === 'miner') expect(f.ships.length).toBe(1);
        if (f.role === 'pirate') pirates[f.ships.length > 1 ? 1 : 0] = (pirates[f.ships.length > 1 ? 1 : 0] ?? 0) + 1;
        for (const c of f.ships) {
          ships++;
          const gen = sim.content.factions?.[c.shipgen];
          const cls = galaxy.fleet.classes[c.shipgen]?.[previewHull(gen!, c.seed, c.depth)];
          if (cls?.size === c.size) classed++;
        }
      }
    }
    expect(withDens).toBeGreaterThanOrEqual(MIN_PIRATE_WORLDS);
    expect([...kinds].sort()).toEqual(['den', 'depot', 'nest', 'outpost', 'station']);
    // Pirates lean strongly to one ship; two small ones now and then.
    expect(pirates[0]).toBeGreaterThan((pirates[1] ?? 0) * 2);
    expect(pirates[1]).toBeGreaterThan(0);
    expect(ships).toBeGreaterThan(200);
    expect(classed / ships).toBeGreaterThan(0.97);
  }, 300000);

  it('a long run: no ship disappears, and every fleet stays at valid nodes with a home', () => {
    const sim = world(35, 1);
    const ships = new Set(sim.galaxy.fleets.flatMap((f) => f.ships.map((c) => c.id)));
    for (let t = 1; t <= 600; t++) {
      onTurn(sim, ++sim.galaxy.turn);
      if (t % 100 === 0) {
        const index = galaxyIndex(sim.galaxy);
        const now = new Set(sim.galaxy.fleets.flatMap((f) => f.ships.map((c) => c.id)));
        expect(now).toEqual(ships);
        for (const f of sim.galaxy.fleets) {
          expect(index.nodes.has(f.node)).toBe(true);
          expect(index.nodes.has(portNode(f.home))).toBe(true);
          for (const n of f.route) expect(index.nodes.has(n)).toBe(true);
        }
      }
    }
  }, 120000);

  it('frozen fleets caught up after any absence end valid, and the same fleet caught up twice is the same', () => {
    for (const k of [CATCHUP_MAX - 1, CATCHUP_MAX, CATCHUP_MAX + 1, 250, 2000]) {
      const run = () => {
        const sim = world(36, 1);
        const here = sim.galaxy.current;
        sim.galaxy.current = '__elsewhere__';
        sim.galaxy.turn += k;
        sim.galaxy.current = here;
        syncFleets(sim, sim.galaxy.turn);
        return sim;
      };
      const a = run();
      expect(JSON.stringify(a.galaxy.fleets)).toBe(JSON.stringify(run().galaxy.fleets));
      const index = galaxyIndex(a.galaxy);
      for (const f of a.galaxy.fleets.filter((x) => x.synced === k)) expect(index.nodes.has(f.node)).toBe(true);
    }
  }, 120000);
});
