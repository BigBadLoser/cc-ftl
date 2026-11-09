import type { ShipGrid } from './shipGrid';
import { EVA_THIN_AIR_BELOW } from './tuning';

/**
 * Read-only copies of a ship's fields for the searches that scan a whole ship (pathfinding, the scheduler's views, the thin-air tests), kept
 * while what they copy is unchanged instead of copied again per search. A cache, never saved: keyed on the ship's grid view (a new view
 * for a moved or grown ship, a new sector grid after a load), so a loaded game starts cold and reads the same values.
 */

interface Snap {
  rev: number;
  data: Float64Array;
}
const snaps = new WeakMap<ShipGrid, Map<string, Snap>>();

/**
 * `grid.load(field)` while no tile of the chunks under the ship changed (`grid.revision`, which every write moves). Shared: never write to it.
 */
export function snapshot(grid: ShipGrid, field: string): Float64Array {
  const rev = grid.revision(field);
  let byField = snaps.get(grid);
  if (!byField) snaps.set(grid, (byField = new Map()));
  const hit = byField.get(field);
  if (hit && hit.rev === rev) return hit.data;
  const data = grid.load(field);
  byField.set(field, { rev, data });
  return data;
}

/** A ship's thin-air mask: 1 where o2 is below EVA_THIN_AIR_BELOW, row-major over its rectangle, and an FNV hash of it. */
export interface ThinMask {
  thin: Uint8Array;
  hash: number;
}
const masks = new WeakMap<ShipGrid, { key: number; released: number; mask: ThinMask }>();

/**
 * The thin-air mask of a ship with an o2 field. Only a write that moves a tile across EVA_THIN_AIR_BELOW changes it, or a chunk released
 * (its last floor gone: its o2 drops to empty with no write). The sector grid counts both (its `watch`, `crossings()`; `releases()`), so with
 * that watch the mask is kept until either count moves; without it, while the ship's o2 is unchanged. Shared: never write to it.
 */
export function thinMask(grid: ShipGrid): ThinMask {
  const w = grid.sector.watch();
  const watched = w !== null && w.field === 'o2' && w.below === EVA_THIN_AIR_BELOW;
  // Crossings count up from 0 and revisions too; the sign keeps the two apart should the watch ever be configured away.
  const key = watched ? grid.sector.crossings() : -1 - grid.revision('o2');
  const released = grid.sector.releases();
  const hit = masks.get(grid);
  if (hit && hit.key === key && hit.released === released) return hit.mask;
  const o2 = grid.load('o2');
  const thin = new Uint8Array(o2.length);
  let hash = 2166136261;
  for (let i = 0; i < o2.length; i++) {
    const t = (o2[i] as number) < EVA_THIN_AIR_BELOW ? 1 : 0;
    thin[i] = t;
    hash = Math.imul(hash ^ t, 16777619);
  }
  const mask = { thin, hash };
  masks.set(grid, { key, released, mask });
  return mask;
}
