import type { Arranger } from './arranger';
import type { TransitionStyle } from './types';

/**
 * Hull plating added after an arrangement is complete: plates over seams between misaligned blocks, enclosed
 * pockets filled in, and tapered TRANSITIONS where sections of different widths meet. All of it is wall laid on
 * space only, never over a cell kept open for a gun or airlock face or inside an engine's exhaust, so traversal,
 * module fit and clearances are untouched.
 */

type Cell = { x: number; y: number };
const key = (x: number, y: number): number => (y + 4096) * 8192 + (x + 4096);

/** Lay plating (walls) on the given space cells as one block. */
function addPlate(A: Arranger, cells: Cell[], label: string, donor?: string): number {
  if (cells.length === 0) return 0;
  const X = Math.min(...cells.map((p) => p.x));
  const Y = Math.min(...cells.map((p) => p.y));
  const set = new Set(cells.map((p) => key(p.x, p.y)));
  const W = Math.max(...cells.map((p) => p.x)) - X + 1;
  const H = Math.max(...cells.map((p) => p.y)) - Y + 1;
  const rows = Array.from({ length: H }, (_, j) => Array.from({ length: W }, (_, i) => (set.has(key(X + i, Y + j)) ? '#' : '.')).join(''));
  A.place({ kind: 'plate', label: donor ? `${donor}: ${label}` : label, access: 'external', rows, legend: new Map(), ports: [], faceE: [], origin: { x: 0, y: 0 }, exposed: [], ...(donor ? { donor } : {}) }, X, Y);
  return set.size;
}

const free = (A: Arranger, x: number, y: number): boolean => A.cell(x, y) === undefined && !A.reserved(x, y);

/** Patch plates: gaps of at most `maxGap` tiles between two hull walls (seams between misaligned blocks). */
export function plate(A: Arranger, maxGap: number, label = 'patch plates', donor = 'scrap'): number {
  const wall = (x: number, y: number): boolean => A.cell(x, y) === '#';
  const b = A.box();
  const cells = new Map<number, Cell>();
  for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
    for (let y = b.y0; y <= b.y1; y++) {
      for (let x = b.x0; x <= b.x1; x++) {
        if (!wall(x, y) || A.cell(x + dx, y + dy) !== undefined) continue;
        let n = 1;
        while (n <= maxGap && A.cell(x + dx * n, y + dy * n) === undefined) n++;
        if (n > maxGap || !wall(x + dx * n, y + dy * n)) continue;
        const run = Array.from({ length: n - 1 }, (_, i) => ({ x: x + dx * (i + 1), y: y + dy * (i + 1) }));
        if (run.every((c) => free(A, c.x, c.y))) for (const c of run) cells.set(key(c.x, c.y), c);
      }
    }
  }
  return addPlate(A, [...cells.values()], label, donor);
}

/** Enclosed space (courtyards with no way out to open space), as connected regions of cells. */
function enclosed(A: Arranger): Cell[][] {
  const b = A.box();
  const seen = new Set<number>();
  const flood = (sx: number, sy: number): Cell[] => {
    const out = [{ x: sx, y: sy }];
    seen.add(key(sx, sy));
    for (let i = 0; i < out.length; i++) {
      const { x, y } = out[i] as Cell;
      for (const [a, c] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
        if (a < b.x0 - 1 || c < b.y0 - 1 || a > b.x1 + 1 || c > b.y1 + 1 || seen.has(key(a, c)) || A.cell(a, c) !== undefined) continue;
        seen.add(key(a, c));
        out.push({ x: a, y: c });
      }
    }
    return out;
  };
  flood(b.x0 - 1, b.y0 - 1);
  const regions: Cell[][] = [];
  for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) if (A.cell(x, y) === undefined && !seen.has(key(x, y))) regions.push(flood(x, y));
  return regions;
}

/** Enclosed space cells in all (scoring pressure against courtyards). */
export const holes = (A: Arranger): number => enclosed(A).reduce((t, r) => t + r.length, 0);

/** Plate over enclosed pockets of at most `max` cells (never one a gun or airlock must see out of). */
export function fillHoles(A: Arranger, max: number): number {
  return addPlate(A, enclosed(A).filter((r) => r.length <= max && !r.some((c) => A.reserved(c.x, c.y))).flat(), 'filled pocket');
}

/**
 * Tapered transitions: wherever a wider section's wall rises from a narrower one's outer wall (a concave step on
 * the outline where two blocks meet), fill the corner with a stepped diagonal of plating, up to the step height and as far along the
 * narrower section as the slope asks. Cells that are reserved (gun and airlock faces, exhaust) stop the taper
 * there, so equipment is never covered.
 */
export function taper(A: Arranger, style: TransitionStyle, rand: () => number): number {
  const b = A.box();
  const cells = new Map<number, Cell>();
  const solid = (x: number, y: number): boolean => A.cell(x, y) !== undefined && !cells.has(key(x, y));
  // Which block each tile belongs to: transitions bridge two sections, never a step inside one block.
  const owner = new Map<number, number>();
  A.placed.forEach((p, i) => p.block.rows.forEach((row, j) => { for (let k = 0; k < row.length; k++) if (row[k] !== '.') owner.set(key(p.x + k, p.y + j), i); }));
  for (let y = b.y0; y <= b.y1; y++) {
    for (let x = b.x0; x <= b.x1; x++) {
      if (!free(A, x, y) || cells.has(key(x, y))) continue;
      for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
        // A corner: the wider section's wall beside (x + dx), the narrower one's outer wall below (y + dy).
        if (!solid(x + dx, y) || !solid(x, y + dy) || owner.get(key(x + dx, y)) === owner.get(key(x, y + dy))) continue;
        let h = 0;
        while (h < style.max && solid(x + dx, y - dy * h) && free(A, x, y - dy * h)) h++;
        let r = 0;
        while (r < style.max * style.slope && solid(x - dx * r, y + dy) && free(A, x - dx * r, y)) r++;
        const height = Math.min(h, Math.floor(r / style.slope));
        if (height < 1) continue;
        for (let j = 0; j < height; j++) {
          const ragged = style.jitter > 0 ? Math.round((rand() - 0.5) * 2 * style.jitter * style.slope) : 0;
          const len = Math.max(0, Math.round((height - j) * style.slope) + ragged);
          for (let i = 0; i < len; i++) {
            const cx = x - dx * i;
            const cy = y - dy * j;
            if (!free(A, cx, cy)) break;
            cells.set(key(cx, cy), { x: cx, y: cy });
          }
        }
      }
    }
  }
  return addPlate(A, [...cells.values()], style.label);
}
