import { Builder } from '../builder';
import { letterOf } from '../canvas';
import type { Rng } from '../../rng';
import { DIRS4, DIRS8, K } from './grid';
import type { Ctx2, Door } from './kit';

/**
 * From owned tiles to a drawn station (docs/STATIONGEN2.md section 3.5): walls fall on the side of the lower-precedence
 * owner wherever two owners meet (one wall between them), on every room tile beside open space or the hull, and where
 * a strategy marked solid; doors are set where each room asked for one; then everything is stamped onto a Builder
 * canvas, one part per room.
 */

export interface Drawn {
  wall: Uint8Array;
  floor: Int32Array;
  doors: number[];
}

/** Walls, floors and doors; a reason string if a room ends up without floor or a door. */
export function build(c: Ctx2): Drawn | string {
  const { g, rooms } = c;
  const n = g.kind.length;
  for (let i = 0; i < n; i++) if (g.kind[i] === K.Free) g.set(i, K.Solid);
  const wall = new Uint8Array(n);
  const floor = new Int32Array(n).fill(-1);
  c.drawn = { wall, floor };
  for (let i = 0; i < n; i++) {
    const k = g.kind[i];
    if (k === K.Solid) { wall[i] = 1; continue; }
    if (k !== K.Room) continue;
    const me = rooms[g.id[i] as number];
    const p = me?.prec ?? 0;
    const w = g.nb(i, DIRS8).some((j) => {
      const kj = g.kind[j];
      if (kj === K.Space || kj === K.Open) return true;
      return kj === K.Room && g.id[j] !== g.id[i] && (rooms[g.id[j] as number]?.prec ?? 0) > p;
    });
    if (w) wall[i] = 1; else floor[i] = g.id[i] as number;
  }
  // Each room keeps its largest piece of floor; stray bits become wall.
  const tilesOf = new Map<number, number[]>();
  for (let i = 0; i < n; i++) if ((floor[i] as number) >= 0) tilesOf.set(floor[i] as number, [...(tilesOf.get(floor[i] as number) ?? []), i]);
  for (const [id, ts] of tilesOf) {
    const comps = g.components(ts).sort((a, b) => b.length - a.length);
    for (const comp of comps.slice(1)) for (const i of comp) { floor[i] = -1; wall[i] = 1; }
    tilesOf.set(id, comps[0] ?? []);
  }
  const dropped = new Set<number>();
  for (const [id, r] of rooms.entries()) {
    const k = tilesOf.get(id)?.length ?? 0;
    if (r.optional && k < 6) {
      dropped.add(id);
      for (const i of tilesOf.get(id) ?? []) { floor[i] = -1; wall[i] = 1; }
      tilesOf.delete(id);
    } else if (k < (r.spec.role === 'hall' ? 1 : 4)) return `${r.dept} ${r.spec.role}: no floor`;
  }
  const doors: number[] = [];
  const targets = (d: Door): number[] => (d === 'public' ? c.publics : typeof d === 'number' ? [d] : d.any);
  for (const [id, r] of rooms.entries()) {
    if (dropped.has(id)) continue;
    const doorsTo = (to: ReadonlySet<number>): number[] => {
      const cands: number[] = [];
      for (const i of tilesOf.get(id) ?? []) {
        for (const [dx, dy] of DIRS4) {
          const w = g.idx(g.x(i) + dx, g.y(i) + dy), o = g.idx(g.x(i) + 2 * dx, g.y(i) + 2 * dy);
          if (w < 0 || o < 0 || !wall[w] || !to.has(floor[o] as number)) continue;
          // A door in a straight wall: wall on both sides of it.
          const s1 = g.idx(g.x(w) + dy, g.y(w) + dx), s2 = g.idx(g.x(w) - dy, g.y(w) - dx);
          if (s1 >= 0 && s2 >= 0 && wall[s1] && wall[s2]) cands.push(w);
        }
      }
      return cands;
    };
    for (const d of r.doors) {
      let cands = doorsTo(new Set(targets(d)));
      // Where the wall to its own hall has no straight stretch, a room opens onto a room of its department instead.
      if (cands.length === 0 && !r.optional && r.dept !== 'public') {
        cands = doorsTo(new Set([...rooms.keys()].filter((k) => k !== id && !dropped.has(k) && rooms[k]?.dept === r.dept && !rooms[k]?.optional)));
      }
      if (cands.length === 0 && r.optional) {
        // A leftover room no door fits (a sliver on a diagonal) is left as wall.
        dropped.add(id);
        for (const i of tilesOf.get(id) ?? []) { floor[i] = -1; wall[i] = 1; }
        tilesOf.delete(id);
        break;
      }
      if (cands.length === 0) return `${r.dept} ${r.spec.role}: no door (room ${id})`;
      const near = r.doorNear;
      const pick = near !== undefined
        ? cands.reduce((b, w) => (Math.hypot(g.x(w) - g.x(near), g.y(w) - g.y(near)) < Math.hypot(g.x(b) - g.x(near), g.y(b) - g.y(near)) ? w : b))
        : [...cands].sort((a, b) => a - b)[cands.length >> 1] as number;
      doors.push(pick);
    }
  }
  // Every room reached from the public hall.
  const doorSet = new Set(doors);
  const seen = new Uint8Array(n);
  const start = tilesOf.get(0)?.[0];
  if (start === undefined) return 'no hall';
  const stack = [start];
  seen[start] = 1;
  while (stack.length > 0) {
    const i = stack.pop() as number;
    for (const j of g.nb(i)) if (!seen[j] && ((floor[j] as number) >= 0 || doorSet.has(j))) { seen[j] = 1; stack.push(j); }
  }
  for (const [id, ts] of tilesOf) if (!seen[ts[0] as number]) return `${rooms[id]?.dept} ${rooms[id]?.spec.role}: unreachable`;
  return { wall, floor, doors };
}

/** Stamp the drawn station onto a fresh Builder: one part per room, walls round each, the doors. */
export function emit(c: Ctx2, d: Drawn, rng: Rng): Builder {
  const { g, rooms } = c;
  const b = new Builder(rng, -1);
  const n = g.kind.length;
  const byRoom = new Map<number, number[]>();
  for (let i = 0; i < n; i++) if ((d.floor[i] as number) >= 0) byRoom.set(d.floor[i] as number, [...(byRoom.get(d.floor[i] as number) ?? []), i]);
  const walled = new Uint8Array(n);
  for (const [id, ts] of byRoom) {
    const r = rooms[id];
    if (!r) continue;
    const pts = new Set<number>(ts);
    for (const i of ts) for (const j of g.nb(i, DIRS8)) if (d.wall[j]) pts.add(j);
    const xs = [...pts].map((i) => g.x(i)), ys = [...pts].map((i) => g.y(i));
    const x0 = Math.min(...xs), y0 = Math.min(...ys);
    const rows = Array.from({ length: Math.max(...ys) - y0 + 1 }, () => Array<string>(Math.max(...xs) - x0 + 1).fill('.'));
    const letter = letterOf(r.spec.role);
    for (const i of pts) {
      (rows[g.y(i) - y0] as string[])[g.x(i) - x0] = d.wall[i] ? '#' : letter;
      if (d.wall[i]) walled[i] = 1;
    }
    const key = `v2r${id}`;
    b.cv.stamp(rows.map((q) => q.join('')), x0, y0, key);
    b.parts.push({ x: x0, y: y0, w: rows[0]?.length ?? 0, h: rows.length, key, role: r.spec.role, ...(r.spec.role === 'hall' ? {} : { spec: r.spec }) });
  }
  // Solid structure no room borders (thick hull, filled slivers).
  const rest = [...Array(n).keys()].filter((i) => d.wall[i] && !walled[i]);
  if (rest.length > 0) {
    const xs = rest.map((i) => g.x(i)), ys = rest.map((i) => g.y(i));
    const x0 = Math.min(...xs), y0 = Math.min(...ys);
    const rows = Array.from({ length: Math.max(...ys) - y0 + 1 }, () => Array<string>(Math.max(...xs) - x0 + 1).fill('.'));
    for (const i of rest) (rows[g.y(i) - y0] as string[])[g.x(i) - x0] = '#';
    b.cv.stamp(rows.map((q) => q.join('')), x0, y0, 'v2solid');
  }
  for (const i of d.doors) b.cv.setDoor(g.x(i), g.y(i));
  return b;
}
