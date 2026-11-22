/** The coarse tier's pace, measured: flips per 100 coarse ticks galaxy-wide and inside a player's region, shared by the fast guard and the slow sweep. */
import { stepCoarse } from '../../../src/sim/galaxy/coarse';
import { sectorOwners } from '../../../src/sim/galaxy/control';
import { nodesWithin } from '../../../src/sim/galaxy/graph';
import { ensureChunk, galaxyIndex } from '../../../src/sim/galaxy/state';
import { FLEET_AREA_HOPS } from '../../../src/sim/galaxy/tuning';
import { COARSE_TURNS } from '../../../src/sim/galaxy/tuningCoarse';
import { newGame } from '../../../src/sim/newGame';
import type { Sim } from '../../../src/sim/sim';
import { content } from '../../../src/content';

export interface Pace {
  sectors: number;
  /** Flips per 100 coarse ticks galaxy-wide, over the second half of the run (the first half includes the opening land grab). */
  galaxy: number;
  /** The same inside a player's region (the sectors with a node within FLEET_AREA_HOPS), averaged over every sector as the player's position. */
  region: number;
  /** (position, tick) pairs where a region saw two or more flips at once: a player looking twice would see two changes nearby. */
  doubles: number;
}

/** A world with the chunks within `radius` of the start generated. */
export function coarseWorld(seed: number, radius: number): Sim {
  const sim = newGame(seed, content);
  for (let cy = -radius; cy <= radius; cy++) for (let cx = -radius; cx <= radius; cx++) ensureChunk(sim, cx, cy);
  return sim;
}

/** Run `ticks` coarse ticks (no fleets: the pressure is the fronts' own) and measure how fast the map changes. */
export function measurePace(sim: Sim, ticks: number): Pace {
  const index = galaxyIndex(sim.galaxy);
  const sectors = [...index.sectors.values()];
  const regions = sectors.map((s0) => {
    const area = nodesWithin(sim, s0.nodes[0] as string, FLEET_AREA_HOPS);
    return new Set(sectors.filter((s) => s.nodes.some((n) => area.has(n))).map((s) => s.id));
  });
  let prev = sectorOwners(sim);
  let all = 0;
  let near = 0;
  let doubles = 0;
  for (let n = 1; n <= ticks; n++) {
    sim.galaxy.turn = n * COARSE_TURNS;
    stepCoarse(sim, sim.galaxy.turn);
    const now = sectorOwners(sim);
    const changed = [...now].filter(([id, o]) => prev.get(id) !== o).map(([id]) => id);
    if (n > ticks / 2) all += changed.length;
    for (const r of regions) {
      const k = changed.filter((id) => r.has(id)).length;
      if (n > ticks / 2) near += k / regions.length;
      if (k > 1) doubles++;
    }
    prev = now;
  }
  const per100 = (x: number): number => Math.round((x / (ticks / 2)) * 1000) / 10;
  return { sectors: sectors.length, galaxy: per100(all), region: per100(near), doubles };
}
