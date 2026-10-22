/**
 * The starmap's nebula backdrop: the galaxy's terrain density sampled on square tiles around the player, for the view
 * to paint as a soft image. Terrain is a pure function of (seed, position), so tiles are cached for good.
 */
import { galaxyGen, type Sim } from '../sim';
import type { UiNebulaTile } from '../ui/starmapApi';

/** Tile side in map units, samples per side, and how many tiles out from the player's tile are shown. */
export const NEBULA_TILE = 3000;
export const NEBULA_SAMPLES = 50;
export const NEBULA_RING = 3;

const cache = new Map<string, UiNebulaTile>();

/** One tile: density at the centres of NEBULA_SAMPLES x NEBULA_SAMPLES cells, quantized to 0..255. */
function tile(sim: Sim, tx: number, ty: number): UiNebulaTile {
  const key = `${sim.seed}:${tx},${ty}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const terrain = galaxyGen(sim.seed, sim.content.galaxy).terrain;
  const n = NEBULA_SAMPLES;
  const step = NEBULA_TILE / NEBULA_SAMPLES;
  const data = new Uint8Array(n * n);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      data[j * n + i] = Math.round(255 * Math.max(0, Math.min(1, terrain.density(tx * NEBULA_TILE + (i + 0.5) * step, ty * NEBULA_TILE + (j + 0.5) * step))));
    }
  }
  const t = { id: key, x: tx * NEBULA_TILE, y: ty * NEBULA_TILE, size: NEBULA_TILE, n, data };
  cache.set(key, t);
  return t;
}

/** The tiles within NEBULA_RING of the tile holding (x, y): a full square, row by row. */
export function nebulaAround(sim: Sim, x: number, y: number): UiNebulaTile[] {
  const tx = Math.floor(x / NEBULA_TILE);
  const ty = Math.floor(y / NEBULA_TILE);
  const out: UiNebulaTile[] = [];
  for (let dy = -NEBULA_RING; dy <= NEBULA_RING; dy++) {
    for (let dx = -NEBULA_RING; dx <= NEBULA_RING; dx++) out.push(tile(sim, tx + dx, ty + dy));
  }
  return out;
}
