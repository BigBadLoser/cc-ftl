import { describe, expect, it } from 'vitest';
import { CombatC, FTL_CHARGE_SEC, START_NODE, newGame, playerShip } from '../sim';
import { content } from '../content';
import { buildStarmap, emptyStarmap, planStarmapRoute } from './starmapSnapshot';
import { toneOf } from './starmapTone';

describe('starmap snapshot', () => {
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
});
