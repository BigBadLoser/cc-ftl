import type { Builder } from './builder';
import { letterOf } from './canvas';
import type { RoomSpec } from './plan';

/**
 * Dock banks for round rings. Airlocks face north, south or west only (never east, the camera-facing stern), so a
 * ring's docks are reserved up front, before its room band is cut: a bank of docks side by side (sharing walls) on
 * the ring's north and south faces (west too when a bank would grow too wide), each a straight 3-wide room from the
 * corridor wall out past the band's outer edge. Where the corridor steps away from a bank's edge the dock's floor runs
 * down to it, so a dock is a short spur. The band then fills round the banks, split into arcs at the bank centres so no
 * segment straddles a bank, and the rim rooms keep clear of the space beyond them (the docking collars).
 */

type Face = 'n' | 's' | 'w';
const DIR: Record<Face, { ox: number; oy: number; ax: number; ay: number; angle: number }> = {
  n: { ox: 0, oy: -1, ax: 1, ay: 0, angle: -Math.PI / 2 },
  s: { ox: 0, oy: 1, ax: 1, ay: 0, angle: Math.PI / 2 },
  w: { ox: -1, oy: 0, ax: 0, ay: 1, angle: Math.PI },
};
/** Dock pitch along a bank (3 floor and a shared wall). */
const PITCH = 4;

export interface DockBanks {
  /** Bank centres as angles (where the band splits into arcs). */
  splits: number[];
  /** Angle windows (centre, half width) the rim rooms keep clear of. */
  keep: [number, number][];
  /** Labels of the dock rooms. */
  labels: Set<number>;
}

/** How many docks go on each face: north and south shares, west only once a bank would pass `max` docks. */
export function faces(k: number, max: number): Partial<Record<Face, number>> {
  if (k <= 2 * max) return { n: Math.ceil(k / 2), s: Math.floor(k / 2) };
  const w = k - 2 * max;
  return { n: max, s: max, w };
}

/**
 * Stamp `docks` as banks on the ring of radius R (corridor label `ring`), out to radius `reach` (the band's outer
 * edge plus a wall). Returns null when a bank does not fit.
 */
export function dockBanks(b: Builder, R: number, ring: number, docks: RoomSpec[], reach: number): DockBanks | null {
  const out: DockBanks = { splits: [], keep: [], labels: new Set() };
  if (docks.length === 0) return out;
  const cv = b.cv;
  // A bank stays within about 30 degrees of its face's axis.
  const max = Math.max(1, Math.floor((R * 0.9 - 1) / PITCH));
  const per = faces(docks.length, max);
  let next = 0;
  for (const f of ['n', 's', 'w'] as const) {
    const k = per[f] ?? 0;
    if (k === 0) continue;
    const d = DIR[f];
    const xy = (a: number, o: number): [number, number] => [a * d.ax + o * d.ox, a * d.ay + o * d.oy];
    const top = Math.ceil(reach) + 1;
    for (let i = 0; i < k; i++) {
      const spec = docks[next++] as RoomSpec;
      const c = Math.round((i - (k - 1) / 2) * PITCH);
      // Floor: columns c-1..c+1 from just inside the outer wall (`top`) inward while the cell and its 8 neighbours
      // are clear of other floor; the corridor's wall stops it.
      const cells: [number, number][] = [];
      const clear = (x: number, y: number): boolean => {
        if (cv.at(x, y) !== '.') return false;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const q = cv.at(x + dx, y + dy); if (q !== '.' && q !== '#') return false; }
        return true;
      };
      let ok = true;
      const doors: [number, number][] = [];
      for (const a of [c, c - 1, c + 1]) {
        let o = top - 1;
        for (; o > 0; o--) {
          const [x, y] = xy(a, o);
          if (!clear(x, y)) break;
          cells.push([x, y]);
        }
        // The outer rows must be floor in all three columns (the airlock's 3x3 floor beyond its hull row).
        if (o > top - 4) ok = false;
        const [wx, wy] = xy(a, o);
        const [fx, fy] = xy(a, o - 1);
        if (cv.at(wx, wy) === '#' && cv.at(fx, fy) !== '#' && cv.labelAt(fx, fy) === ring) doors.push([wx, wy]);
      }
      const door = doors[0];
      if (!ok || !door) return null;
      const key = `dock${R}:${f}${i}`;
      if (!stampCells(b, cells, key, spec)) return null;
      cv.setDoor(door[0], door[1]);
      out.labels.add(cv.labelAt((cells[0] as [number, number])[0], (cells[0] as [number, number])[1]));
    }
    out.splits.push(d.angle);
    // Keep the rim rooms clear of the bank and the collars beyond it.
    out.keep.push([d.angle, ((k * PITCH) / 2 + 6) / Math.max(1, reach)]);
  }
  return out;
}

/** Stamp a floor set as a room of `spec` with walls on every 8-neighbour that is not floor. */
function stampCells(b: Builder, cells: [number, number][], key: string, spec: RoomSpec): boolean {
  const xs = cells.map((p) => p[0]);
  const ys = cells.map((p) => p[1]);
  const bx = Math.min(...xs) - 1, by = Math.min(...ys) - 1;
  const rows = Array.from({ length: Math.max(...ys) - by + 2 }, () => Array<string>(Math.max(...xs) - bx + 2).fill('.'));
  for (const [x, y] of cells) (rows[y - by] as string[])[x - bx] = letterOf(spec.role);
  for (const [x, y] of cells) {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const row = rows[y + dy - by] as string[];
      if (row[x + dx - bx] === '.') row[x + dx - bx] = '#';
    }
  }
  if (!b.cv.stamp(rows.map((q) => q.join('')), bx, by, key)) return false;
  b.parts.push({ x: bx, y: by, w: rows[0]?.length ?? 0, h: rows.length, key, role: spec.role, spec });
  return true;
}

/** Split full-circle arcs at the bank angles: the arcs between consecutive splits (one arc when there are none). */
export function arcsBetween(splits: number[], a0 = 0, a1 = Math.PI * 2): [number, number][] {
  if (splits.length === 0) return [[a0, a1]];
  const s = [...splits].map((a) => ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)).sort((p, q) => p - q);
  return s.map((a, i): [number, number] => [a, i + 1 < s.length ? (s[i + 1] as number) : (s[0] as number) + Math.PI * 2]);
}

/** Remove angle windows (centre, half width) from a list of arcs. */
export function without(arcs: [number, number][], keep: [number, number][]): [number, number][] {
  let out = arcs;
  const T = Math.PI * 2;
  for (const [c, h] of keep) {
    const next: [number, number][] = [];
    for (const [a, z] of out) {
      // The window's copy that overlaps this arc's turn.
      let lo = c - h, hi = c + h;
      while (hi < a) { lo += T; hi += T; }
      while (lo > z) { lo -= T; hi -= T; }
      if (hi <= a || lo >= z) { next.push([a, z]); continue; }
      if (lo > a) next.push([a, lo]);
      if (hi < z) next.push([hi, z]);
    }
    out = next;
  }
  return out.filter(([a, z]) => z - a > 0.05);
}
