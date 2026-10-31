import { describe, expect, it } from 'vitest';
import { CombatC, burnFuel, fuelStock, FTL_CHARGE_SEC, START_NODE, newGame, playerShip, visibleFleets } from '../sim';
import { content } from '../content';
import { buildStarmap, emptyStarmap, planStarmapRoute } from './starmapSnapshot';
import { toneOf } from './starmapTone';

describe('starmap snapshot', () => {
  it('while adrift after a flee the starmap plots a course from the node fled and asks for no charge', () => {
    const sim = newGame(1, content);
    const ship = playerShip(sim);
    (sim.world.get(ship, CombatC) as { ftl: number }).ftl = FTL_CHARGE_SEC;
    sim.enqueue({ type: 'combat.flee', ship });
    sim.step();
    const map = buildStarmap(sim);
    expect(map).toMatchObject({ state: 'hyperspace', current: START_NODE, travel: { phase: 'adrift', route: [START_NODE] } });
    const to = map.nodes.find((n) => n.reachable && n.known)!.id;
    const route = planStarmapRoute(sim, to)!;
    expect(route).toMatchObject({ blocker: null, chargeOk: true, nextCharge: 0, overweight: null, path: [START_NODE, to] });
  });

  it('builds the sector, cluster and galaxy levels from the generated galaxy', () => {
    const map = buildStarmap(newGame(1, content));
    expect(map.current).toBe(START_NODE);
    expect(map.ship).toBeGreaterThan(0);
    expect(map.nodes.some((n) => n.current && n.known)).toBe(true);
    expect(map.nodes.filter((n) => n.reachable).length).toBeGreaterThan(0);
    expect(map.sectors.find((s) => s.id === map.currentSector)?.outline).toMatch(/^M/);
    expect(map.clusters.length).toBeGreaterThan(1);
    expect(map.clusters.find((c) => c.current)).toMatchObject({ revealed: true, tone: 'cyan', type: 'core' });
    expect(map.clusterLinks.length).toBeGreaterThan(0);
    expect(map.nebula).toHaveLength(49);
    // The data holds theme tones, never CSS or hex.
    expect(JSON.stringify({ ...map, nebula: [] })).not.toMatch(/#[0-9a-f]{3,6}\b|region/i);
  });

  it('lists only the NPC fleets within sensor range, with their heading and a theme tone', () => {
    const sim = newGame(22, content);
    const map = buildStarmap(sim);
    const seen = new Set(visibleFleets(sim).map((f) => f.id));
    expect(map.fleets.map((f) => f.id)).toEqual([...seen]);
    expect(map.fleets.length).toBeGreaterThan(0);
    expect(map.fleets.length).toBeLessThan(sim.galaxy.fleets.length);
    for (const f of map.fleets) {
      expect(['cyan', 'amber', 'green', 'red', 'text', 'dim']).toContain(f.tone);
      expect(f.heading).toMatch(/^(Resting at|Returning home to|Trading run to|Mining run to|On patrol to|Prowling to|Trading at|Mining at|On patrol at|Lurking at) .+|Adrift$/);
      expect(f.name.length).toBeGreaterThan(3);
      expect(f.home).not.toBe('');
    }
  });

  it('keeps every faction tone on the theme scale and an empty map before the first build', () => {
    expect(toneOf('government')).toBe('cyan');
    expect(toneOf('pirates')).toBe('red');
    expect(toneOf(undefined)).toBe('dim');
    expect(emptyStarmap()).toMatchObject({ rev: -1, nodes: [], clusters: [] });
  });

  it('plans a route to a neighbour and says why it cannot go yet', () => {
    const sim = newGame(2, content);
    const map = buildStarmap(sim);
    const to = map.nodes.find((n) => n.reachable)!.id;
    const uncharged = planStarmapRoute(sim, to)!;
    expect(uncharged).toMatchObject({ hops: 1, fuelOk: true, chargeOk: false });
    expect(uncharged.legs).toHaveLength(1);
    expect(uncharged.blocker).toMatch(/charging/);
    const combat = sim.world.get(playerShip(sim), CombatC)!;
    combat.ftl = FTL_CHARGE_SEC;
    expect(planStarmapRoute(sim, to)).toMatchObject({ chargeOk: true, blocker: null });
    expect(planStarmapRoute(sim, START_NODE)).toBeNull();
  });

  it('reports a fuel shortfall as a positive count, never a negative fuel left', () => {
    const sim = newGame(2, content);
    const to = buildStarmap(sim).nodes.find((n) => n.reachable)!.id;
    const full = planStarmapRoute(sim, to)!;
    expect(full).toMatchObject({ fuelOk: true, fuelShort: 0 });
    burnFuel(sim, fuelStock(sim));
    const dry = planStarmapRoute(sim, to)!;
    expect(dry.fuelOk).toBe(false);
    expect(dry.fuelShort).toBe(dry.fuel);
    expect(dry.fuelShort).toBeGreaterThan(0);
  });
});
