import type { GridLike } from './grid';
import type { Sim } from './sim';

/** One structure in the sector that field systems run over: today a grid window (its whole local rectangle). */
export interface Region {
  gridId: number;
  grid: GridLike;
}

/**
 * Every region, in ascending grid id: the fixed order field systems iterate in (never Map insertion order, so a load or
 * a different spawn order cannot reorder rng draws). Grids spawn with ascending ids, so this is the order they always ran in.
 */
export function regions(sim: Sim): Region[] {
  return [...sim.grids.keys()].sort((a, b) => a - b).map((gridId) => ({ gridId, grid: sim.grids.get(gridId) as GridLike }));
}
