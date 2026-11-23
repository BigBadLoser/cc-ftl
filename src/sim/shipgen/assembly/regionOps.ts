import type { Builder } from '../builder';
import { letterOf } from '../canvas';
import type { Region, RegionGrid } from './regions';

/** What a compiled `RegionGrid` is asked after the wall rule: rooms whose floor is not a rectangle, stranded floor, the stamp into a builder. */

/**
 * Rooms in the box x0 <= x < x1, y0 <= y < y1 whose floor, as the grid stands, is not one rectangle (a notch or a
 * bump where a wall took part of one edge), as region ids. Only rooms wholly inside the box are judged.
 */
export function lumps(g: RegionGrid, x0: number, y0: number, x1: number, y1: number): Set<number> {
  const box = new Map<number, [number, number, number, number, number, boolean]>();
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const a = g.at(x, y);
    if (a < 0 || (g.regions[a] as Region).hall) continue;
    let b = box.get(a);
    if (!b) box.set(a, (b = [x, y, x, y, 0, false]));
    if (x === x0 || y === y0 || x === x1 - 1 || y === y1 - 1) b[5] = true;
    if (g.wallAt(x, y)) continue;
    if (b[4] === 0) { b[0] = x; b[1] = y; b[2] = x; b[3] = y; }
    b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y); b[4]++;
  }
  const out = new Set<number>();
  for (const [id, [bx0, by0, bx1, by1, n, edge]] of box) if (!edge && n > 0 && n !== (bx1 - bx0 + 1) * (by1 - by0 + 1)) out.add(id);
  return out;
}

/**
 * Floor that cannot be walked to from the first hall, as [x, y, region] of one tile a stranded region: a room with no
 * door, or a hall cut off from the rest (but not a region standing `apart`: a module reached across open ground). The fit-out places nothing solid while any floor is stranded.
 */
export function stranded(g: RegionGrid, cell: string[] = g.compile()): [number, number, number][] {
  const apart = g.apart;
  const { size, half } = g;
  const walk = (k: number): boolean => cell[k] === '_' || cell[k] === 'D';
  const start = cell.findIndex((c, k) => c === '_' && (g.own[k] as number) >= 0 && (g.regions[g.own[k] as number] as Region).hall);
  if (start < 0) return [];
  const seen = new Uint8Array(cell.length);
  const stack = [start];
  seen[start] = 1;
  while (stack.length > 0) {
    const k = stack.pop() as number;
    for (const j of [k - 1, k + 1, k - size, k + size]) if (j >= 0 && j < cell.length && !seen[j] && walk(j)) { seen[j] = 1; stack.push(j); }
  }
  const out = new Map<number, [number, number, number]>();
  for (let k = 0; k < cell.length; k++) {
    if (cell[k] !== '_' || seen[k]) continue;
    const id = g.own[k] as number;
    if (apart.has(id)) continue;
    if (!out.has(id)) out.set(id, [(k % size) - half, Math.floor(k / size) - half, id]);
  }
  return [...out.values()];
}

/** Stamp the compiled floor into a builder: one chunk a region (its spec with it), then every wall and door. */
export function stampGrid(g: RegionGrid, b: Builder): void {
  const { size, half } = g;
  const cell = g.compile();
  const rowsOf = (keep: (k: number) => string | null): { rows: string[]; x0: number; y0: number } | null => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let k = 0; k < cell.length; k++) {
      if (keep(k) === null) continue;
      const x = k % size, y = Math.floor(k / size);
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
    if (x1 < x0) return null;
    const rows: string[] = [];
    for (let y = y0; y <= y1; y++) {
      let row = '';
      for (let x = x0; x <= x1; x++) row += keep(y * size + x) ?? '.';
      rows.push(row);
    }
    return { rows, x0: x0 - half, y0: y0 - half };
  };
  g.regions.forEach((rg, id) => {
    const letter = letterOf(rg.role);
    const f = rowsOf((k) => (cell[k] === '_' && g.own[k] === id ? letter : null));
    if (!f) return;
    const key = `flow${id}`;
    b.cv.stamp(f.rows, f.x0, f.y0, key);
    b.chunkRoles.set(`${key}:${letter}`, rg.role);
    if (rg.spec) b.chunkSpecs.set(`${key}:${letter}`, rg.spec);
  });
  const w = rowsOf((k) => (cell[k] === '#' || cell[k] === 'D' ? (cell[k] as string) : null));
  if (w) b.cv.stamp(w.rows, w.x0, w.y0, 'flowwalls');
}
