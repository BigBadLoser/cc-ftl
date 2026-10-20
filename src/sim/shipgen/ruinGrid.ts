import { footprintTiles, openTilesOf } from '../modules/footprint';
import type { RuinCtx } from './ruinTypes';

/** Tile helpers for the ruin stages, over the padded char grid. */

export const N4: readonly (readonly [number, number])[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function at(c: RuinCtx, x: number, y: number): string {
  return x < 0 || y < 0 || x >= c.width || y >= c.height ? '.' : (c.cells[y * c.width + x] as string);
}

export function put(c: RuinCtx, x: number, y: number, ch: string): void {
  if (x >= 0 && y >= 0 && x < c.width && y < c.height) c.cells[y * c.width + x] = ch;
}

export const walkable = (ch: string): boolean => ch === '_' || ch === 'D';

/** True if a tile touches space (4-neighbour, the grid edge counts as space). */
export function touchesSpace(c: RuinCtx, x: number, y: number): boolean {
  return N4.some(([dx, dy]) => at(c, x + dx, y + dy) === '.');
}

/** Hull tiles: walls with space on any of their 8 neighbours. */
export function isHull(c: RuinCtx, x: number, y: number): boolean {
  if (at(c, x, y) !== '#') return false;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (at(c, x + dx, y + dy) === '.') return true;
  return false;
}

/** Footprint tiles of template module `i`. */
export function modTiles(c: RuinCtx, i: number): { x: number; y: number }[] {
  const m = c.modules[i];
  const def = m && c.defs[m.def];
  return m && def ? footprintTiles(def, m.x, m.y, m.rot) : [];
}

/** Module index per tile (-1 none). */
export function moduleMap(c: RuinCtx): Int32Array {
  const out = new Int32Array(c.width * c.height).fill(-1);
  c.modules.forEach((_, i) => {
    for (const t of modTiles(c, i)) if (t.x >= 0 && t.y >= 0 && t.x < c.width && t.y < c.height) out[t.y * c.width + t.x] = i;
  });
  return out;
}

/** Connected components of tiles matching `pass` (4-neighbour). Returns a label per tile (-1 outside) and sizes. */
export function components(c: RuinCtx, pass: (i: number) => boolean): { label: Int32Array; sizes: number[] } {
  const label = new Int32Array(c.width * c.height).fill(-1);
  const sizes: number[] = [];
  for (let s = 0; s < label.length; s++) {
    if (label[s] !== -1 || !pass(s)) continue;
    const id = sizes.length;
    let n = 0;
    const stack = [s];
    label[s] = id;
    while (stack.length) {
      const i = stack.pop() as number;
      n++;
      const x = i % c.width;
      const y = (i - x) / c.width;
      for (const [dx, dy] of N4) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= c.width || ny >= c.height) continue;
        const j = ny * c.width + nx;
        if (label[j] === -1 && pass(j)) {
          label[j] = id;
          stack.push(j);
        }
      }
    }
    sizes.push(n);
  }
  return { label, sizes };
}

/** Rooms: floor regions bounded by walls and doors (doors belong to no room). */
export function roomLabels(c: RuinCtx): { label: Int32Array; sizes: number[] } {
  return components(c, (i) => c.cells[i] === '_');
}

/** Breadth-first distance over tiles matching `pass`, from `starts`. Unreached tiles are -1. */
export function bfs(c: RuinCtx, starts: number[], pass: (i: number) => boolean): Int32Array {
  const dist = new Int32Array(c.width * c.height).fill(-1);
  const q: number[] = [];
  for (const s of starts) if (dist[s] === -1) { dist[s] = 0; q.push(s); }
  for (let h = 0; h < q.length; h++) {
    const i = q[h] as number;
    const x = i % c.width;
    const y = (i - x) / c.width;
    for (const [dx, dy] of N4) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= c.width || ny >= c.height) continue;
      const j = ny * c.width + nx;
      if (dist[j] === -1 && pass(j)) {
        dist[j] = (dist[i] as number) + 1;
        q.push(j);
      }
    }
  }
  return dist;
}

/** Deterministic in-place shuffle. */
export function shuffle<T>(c: RuinCtx, xs: T[]): T[] {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = c.rng.int(0, i);
    [xs[i], xs[j]] = [xs[j] as T, xs[i] as T];
  }
  return xs;
}

/** Extra weight at the top of the intensity range: 0 up to 0.5, then rising to 1 at 1 (so 0.9 is clearly devastating). */
export function heavy(c: RuinCtx): number {
  return Math.max(0, (c.intensity - 0.5) / 0.5);
}

/** 1 on tiles a solid module blocks (its open tiles excepted), as the walk rules see them. */
export function solidMap(c: RuinCtx): Uint8Array {
  const out = new Uint8Array(c.width * c.height);
  c.modules.forEach((m, i) => {
    const def = c.defs[m.def];
    if (!def?.solid) return;
    const open = new Set(openTilesOf(def, m.x, m.y, m.rot).map((t) => t.y * c.width + t.x));
    for (const t of modTiles(c, i)) {
      const k = t.y * c.width + t.x;
      if (t.x >= 0 && t.y >= 0 && t.x < c.width && t.y < c.height && !open.has(k)) out[k] = 1;
    }
  });
  return out;
}
