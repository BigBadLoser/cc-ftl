import type { Grid } from '../grid';
import type { Sim } from '../sim';
import { isTileWalkable } from '../modules/walk';
import { Struct } from '../structure';

export interface Tile {
  x: number;
  y: number;
}

/** A tile as a set key (sector coordinates are well under 65536). */
export const tileKey = (x: number, y: number): number => x * 65536 + y;

/** How far (in steps) from the clicked tile a group may spread. */
const SPREAD_RADIUS = 10;
const DIRS: readonly Tile[] = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }];

/**
 * The `count` standing tiles nearest to `goal`, nearest first: a walk outward from the goal over walkable tiles, so walls
 * and closed rooms keep the group together. Doorways and tiles in `taken` (keys from `tileKey`) are crossed but never
 * stood on. The goal itself comes first when it is free. Fewer than `count` come back only when the room runs out of floor.
 */
export function spreadTiles(sim: Sim, grid: Grid, goal: Tile, count: number, taken: ReadonlySet<number> = new Set()): Tile[] {
  if (!isTileWalkable(sim, grid, goal.x, goal.y)) return [];
  const key = (t: Tile): number => tileKey(t.x, t.y);
  const seen = new Set<number>([key(goal)]);
  const out: Tile[] = [];
  let ring: Tile[] = [goal];
  for (let depth = 0; depth <= SPREAD_RADIUS && ring.length > 0 && out.length < count; depth++) {
    const next: Tile[] = [];
    for (const t of ring) {
      if (grid.get('struct', t.x, t.y) !== Struct.Door && !taken.has(key(t)) && out.length < count) out.push(t);
      for (const d of DIRS) {
        const n = { x: t.x + d.x, y: t.y + d.y };
        if (seen.has(key(n)) || !isTileWalkable(sim, grid, n.x, n.y)) continue;
        seen.add(key(n));
        next.push(n);
      }
    }
    ring = next;
  }
  return out;
}

/**
 * Give each walker one of the tiles, nearest pairs first (ties by crew id, then tile order), so a group does not cross over
 * itself. More walkers than tiles: the extras share the tiles again from the nearest end. No tiles: an empty map.
 */
export function assignTiles(walkers: readonly { id: number; x: number; y: number }[], tiles: readonly Tile[]): Map<number, Tile> {
  const out = new Map<number, Tile>();
  if (tiles.length === 0) return out;
  const left = [...walkers].sort((a, b) => a.id - b.id);
  for (let round = 0; left.length > 0; round++) {
    const free = tiles.map((t, i) => ({ t, i }));
    const batch = left.splice(0, free.length);
    const pairs: { d: number; w: (typeof batch)[number]; i: number }[] = [];
    for (const w of batch) for (const f of free) pairs.push({ d: Math.abs(w.x - f.t.x) + Math.abs(w.y - f.t.y), w, i: f.i });
    pairs.sort((a, b) => a.d - b.d || a.w.id - b.w.id || a.i - b.i);
    const usedTile = new Set<number>();
    for (const p of pairs) {
      if (out.has(p.w.id) || usedTile.has(p.i)) continue;
      out.set(p.w.id, tiles[p.i] as Tile);
      usedTile.add(p.i);
    }
    if (round > 50) break;
  }
  return out;
}
