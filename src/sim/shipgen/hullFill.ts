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

/**
 * Plate over enclosed pockets of at most `max` cells (never one a gun or airlock must see out of, nor daylight between
 * the members of bare structure: struts, braces, frames).
 */
export function fillHoles(A: Arranger, max: number): number {
  const bare = new Set<number>();
  for (const p of A.placed) {
    if (!p.block.bare) continue;
    p.block.rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] !== '.') bare.add(key(p.x + i, p.y + j)); });
  }
  const byBare = (r: Cell[]): boolean => bare.size > 0 && r.some((c) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => bare.has(key(c.x + (dx as number), c.y + (dy as number)))));
  return addPlate(A, enclosed(A).filter((r) => r.length <= max && !r.some((c) => A.reserved(c.x, c.y)) && !byBare(r)).flat(), 'filled pocket');
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
        const oa = owner.get(key(x + dx, y));
        const ob = owner.get(key(x, y + dy));
        if (!solid(x + dx, y) || !solid(x, y + dy) || oa === ob) continue;
        const bare = (o: number | undefined): boolean => o !== undefined && !!A.placed[o]?.block.bare;
        if (bare(oa) || bare(ob)) continue;
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

/**
 * Plate a shallow, V-shaped recess where a Navy hull narrows to the aft drive.
 * This only shapes the OUTSIDE of a connected fore/aft hull join. It never
 * expands a room or bridges separate twin hulls, and observes gun, airlock,
 * and engine-exhaust reservations. The normal taper handles other joins.
 */
export function fairDriveNecks(A: Arranger, maxRun = 14): number {
  const fair = new Map<number, Cell>();
  const skin = (x: number, center: number, side: -1 | 1): number | null => {
    // A corridor or central structure must exist at the attachment axis.
    let y = center;
    if (A.cell(x, y) === undefined && A.cell(x, y + 1) !== undefined) y++;
    if (A.cell(x, y) === undefined) return null;
    while (Math.abs(y - center) <= 14 && A.cell(x, y + side) !== undefined) y += side;
    return y;
  };
  for (const join of A.joins) {
    const parent = A.placed[join.a];
    const child = A.placed[join.b];
    if (!parent || !child || child.block.kind !== 'drive' || parent.block.kind === 'hull') continue;
    if (join.tiles.length === 0) continue;
    const x0 = Math.round(join.tiles.reduce((sum, p) => sum + p.x, 0) / join.tiles.length);
    const cy = Math.round(join.tiles.reduce((sum, p) => sum + p.y, 0) / join.tiles.length);
    const shoulderX = x0 - 3;
    // A fore/aft join, not an outboard engine pod or diagonal graft.
    if (child.x < parent.x + 2 || child.x > parent.x + Math.max(...parent.block.rows.map((r) => r.length)) + 2) continue;
    for (const side of [-1, 1] as const) {
      const start = skin(shoulderX, cy, side);
      if (start === null) continue;
      const profile: { x: number; y: number }[] = [];
      for (let x = shoulderX + 1; x <= shoulderX + maxRun; x++) {
        const y = skin(x, cy, side);
        if (y === null) break;
        profile.push({ x, y });
        // The far-side shoulder has returned to the parent hull's width.
        if (profile.length >= 2 && side * (y - start) >= -1 &&
            profile.slice(0, -1).some((p) => side * (p.y - start) <= -3)) break;
      }
      if (profile.length < 2) continue;
      const end = profile[profile.length - 1] as { x: number; y: number };
      if (side * (end.y - start) < -1) continue;
      if (!profile.some((p) => side * (p.y - start) <= -3)) continue;
      const run = end.x - shoulderX;
      // Keep intentionally long engineering necks legible: only round their
      // corners. Short one-column notches can be plated right across.
      const maxFill = run >= 8 ? 2 : run >= 6 ? 3 : 6;
      for (const { x, y } of profile.slice(0, -1)) {
        const toward = Math.min(x - shoulderX, end.x - x);
        // The V's shallow shoulders look engineered, rather than a flat
        // rectangular slab joining the full depth of both assemblies.
        const inset = Math.floor(toward / 2);
        const target = start - side * inset;
        const count = Math.min(maxFill, Math.max(0, side * (target - y)));
        for (let n = 1; n <= count; n++) {
          const yy = y + side * n;
          if (!free(A, x, yy)) break;
          fair.set(key(x, yy), { x, y: yy });
        }
      }
    }
  }
  return addPlate(A, [...fair.values()], 'stern shoulder');
}
