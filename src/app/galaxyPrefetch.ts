import { chunkOfId, galaxyGen, type Sim } from '../sim';
import { warmOutlines } from './starmapClusters';

/** Chunks generated ahead of the player: this many rings around their chunk (the sim itself needs FRONTIER_RING = 2). */
export const PREFETCH_RING = 4;
/** At game start, this inner ring is generated before the first frame (the rest follows in idle slots). */
export const START_RING = 3;
/** Normally one chunk every PREFETCH_EVERY bridge updates; for PREFETCH_BOOST_MS after a jump (while the starmap
 * slides the ship along the lane) as many as fit in PREFETCH_BOOST_BUDGET_MS per update. */
export const PREFETCH_EVERY = 4;
export const PREFETCH_BOOST_MS = 1600;
export const PREFETCH_BOOST_BUDGET_MS = 10;

/**
 * Generate ahead: the galaxy is a pure function of (seed, chunk), so chunks around the player can be built early into
 * the generator's cache, with their sector outlines. When a jump then needs them they are ready, and the jump does not
 * hitch. Nothing in the sim's state changes. Each call builds at most one chunk, nearest first; returns whether it did.
 */
export function prefetchGalaxy(sim: Sim, ring = PREFETCH_RING): boolean {
  const key = chunkOfId(sim.galaxy.current);
  if (!key) return false;
  const [cx, cy] = key.split(',').map(Number) as [number, number];
  const gen = galaxyGen(sim.seed, sim.content.galaxy);
  for (let r = 0; r <= ring; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || gen.hasChunk(cx + dx, cy + dy)) continue;
        warmOutlines(gen.chunk(cx + dx, cy + dy));
        return true;
      }
    }
  }
  return false;
}

/** Game start: build the inner START_RING right away (a short wait while loading beats a hitch on the first jumps). */
export function prefetchStart(sim: Sim): void {
  while (prefetchGalaxy(sim, START_RING));
}
