import type { Assignment } from './assign';
import { DIRS4, K } from './grid';
import type { Ctx2 } from './kit';
import { CABIN_GROSS, type Dept } from './program';
import type { Drawn } from './walls';

/**
 * Footprint accounting for a finished v2 station (the debug caption and the bench): what the contents need against
 * what the hull holds, the floor by use, and each department's cohesion (connected groups and walking distance).
 */

/** Hull area per required tile assumed when a radius is implied from the required area (walls, curvature). */
export const PACKING = 0.8;

export interface FootStats {
  /** Facilities at target size with their walls, plus the circulation built (public and department halls). */
  required: number;
  /** Tiles the parcels, public network and courts got. */
  allocated: number;
  /** Every tile inside the hull. */
  inside: number;
  R: number;
  /** The radius the required area implies: pi r^2 = required / PACKING. */
  rReq: number;
  useful: number;
  corridor: number;
  plaza: number;
  absorber: number;
  unallocated: number;
  /** Per department: connected groups, and mean walk between its rooms over the station's mean. */
  cohesion: Record<string, { groups: number; walk: number }>;
}

export function footStats(c: Ctx2, d: Drawn, a: Assignment, depts: readonly Dept[]): FootStats {
  const { g, rooms } = c;
  const n = g.kind.length;
  const gross = depts.reduce((t, dp) => t + dp.facilities.reduce((s, f) => s + (f.spec.cabin ? CABIN_GROSS : (f.spec.w + 1) * (f.spec.h + 1)), 0), 0);
  let useful = 0, corridor = 0, plaza = 0, absorber = 0, inside = 0, hallTiles = 0;
  for (let i = 0; i < n; i++) {
    const k = g.kind[i];
    if (k !== K.Space && k !== K.Open) inside++;
    const id = d.floor[i] as number;
    if (id < 0) continue;
    const r = rooms[id];
    if (!r) continue;
    if (r.spec.role === 'hall') { corridor++; hallTiles++; }
    else if (r.spec.role === 'plaza') plaza++;
    else if (r.optional) absorber++;
    else useful++;
  }
  const courts = a.courts.reduce((t, x) => t + x.length, 0);
  const allocated = a.parcels.reduce((t, p) => t + p.tiles.length, 0) + g.tiles((k) => k === K.Hall).length + courts;
  const required = gross + hallTiles;
  // Walking: BFS over floor and doors from each room's first floor tile.
  const doorSet = new Set(d.doors);
  const first = new Map<number, number>();
  for (let i = 0; i < n; i++) { const id = d.floor[i] as number; if (id >= 0 && !first.has(id)) first.set(id, i); }
  const ids = [...first.keys()].filter((id) => rooms[id]?.dept !== 'public');
  const dist = new Map<number, Map<number, number>>();
  const bfs = (src: number): Map<number, number> => {
    const seen = new Int32Array(n).fill(-1);
    seen[src] = 0;
    let q = [src];
    while (q.length > 0) {
      const next: number[] = [];
      for (const i of q) for (const j of g.nb(i)) if (seen[j] === -1 && ((d.floor[j] as number) >= 0 || doorSet.has(j))) { seen[j] = (seen[i] as number) + 1; next.push(j); }
      q = next;
    }
    const out = new Map<number, number>();
    for (const id of ids) { const t = first.get(id) as number; if ((seen[t] as number) >= 0) out.set(id, seen[t] as number); }
    return out;
  };
  for (const id of ids) dist.set(id, bfs(first.get(id) as number));
  const mean = (pairs: [number, number][]): number => {
    const v = pairs.map(([p, q]) => dist.get(p)?.get(q)).filter((x): x is number => x !== undefined);
    return v.length > 0 ? v.reduce((t, x) => t + x, 0) / v.length : 0;
  };
  const allPairs = ids.flatMap((p, k) => ids.slice(k + 1).map((q) => [p, q] as [number, number]));
  const station = mean(allPairs) || 1;
  // Groups: rooms of a department joined by a door between two of its rooms.
  const cohesion: FootStats['cohesion'] = {};
  for (const dp of depts) {
    const mine = ids.filter((id) => rooms[id]?.dept === dp.id);
    if (mine.length === 0) continue;
    const parent = new Map(mine.map((id) => [id, id]));
    const find = (x: number): number => { let r = x; while (parent.get(r) !== r) r = parent.get(r) as number; return r; };
    for (const w of d.doors) {
      for (const [dx, dy] of DIRS4) {
        const p = g.idx(g.x(w) + dx, g.y(w) + dy), q = g.idx(g.x(w) - dx, g.y(w) - dy);
        if (p < 0 || q < 0) continue;
        const a1 = d.floor[p] as number, b1 = d.floor[q] as number;
        if (parent.has(a1) && parent.has(b1)) parent.set(find(a1), find(b1));
      }
    }
    const groups = new Set(mine.map(find)).size;
    const pairs = mine.flatMap((p, k) => mine.slice(k + 1).map((q) => [p, q] as [number, number]));
    cohesion[dp.id] = { groups, walk: pairs.length > 0 ? mean(pairs) / station : 0 };
  }
  return {
    required, allocated, inside, R: a.s.R, rReq: Math.sqrt(required / (Math.PI * PACKING)),
    useful, corridor, plaza, absorber, unallocated: courts, cohesion,
  };
}

/** The stats as a short caption. */
export function footLine(s: FootStats): string {
  const coh = Object.entries(s.cohesion).map(([k, v]) => `${k.slice(0, 4)} ${v.groups}g ${v.walk.toFixed(2)}`).join(', ');
  const fl = s.useful + s.corridor + s.plaza + s.absorber;
  const pc = (x: number): string => `${Math.round((100 * x) / Math.max(1, fl))}%`;
  return `req ${s.required} alloc ${s.allocated} inside ${s.inside} R ${s.R} rReq ${s.rReq.toFixed(1)} | useful ${pc(s.useful)} corridor ${pc(s.corridor)} plaza ${pc(s.plaza)} absorber ${pc(s.absorber)} unalloc ${s.unallocated} | ${coh}`;
}
