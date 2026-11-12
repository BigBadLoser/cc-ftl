import type { RoomSpec } from '../plan';
import { shuffle } from '../civilKit';
import { line, type Site } from './lattice';
import { rect, type Built, type Ctx, type Frame } from './model';
import { SOLID, SPACE } from './regions';

/**
 * The hub: what stands inside a ring. A market at the centre, an octagon: a square court, the market's rooms round it
 * (one either side of each spoke; the cut corners go to the rooms beside them, turn about), and a road round the lot.
 * A spoke runs from each side of the court through the market and the road to the ring, and the other rooms the hub
 * takes line the spokes beyond the road. The ground between the spokes stays open to space.
 *
 * It holds what fits: a room that does not is the ring's size to answer for (the assembler tries the next one).
 */
export interface HubOpts {
  /** The court's side in tiles (even). */
  court: number;
  /** How far the market's rooms stand out from the court, walls included. */
  arm: number;
}

/** A spoke's frame at the centre: u runs out along its axis, and the tile at u is u tiles from the middle. */
const SPOKE: readonly Frame[] = [{ x: 0, y: -1, dir: 'n' }, { x: 0, y: 0, dir: 'e' }, { x: 0, y: 0, dir: 's' }, { x: -1, y: 0, dir: 'w' }];
/** A quarter turn clockwise about the middle, `k` times: the north-east quadrant laid on each of the four. */
const turn = (k: number, x: number, y: number): [number, number] => { for (; k > 0; k--) [x, y] = [-1 - y, x]; return [x, y]; };
/** Straight hull either end of a cut corner, so the wall between two rooms never runs into the diagonal. */
const SHOULDER = 3;

const long = (r: RoomSpec): RoomSpec => (r.w >= r.h ? r : { ...r, w: r.h, h: r.w });

export function hub(c: Ctx, s: Site, market: readonly RoomSpec[], rooms: readonly RoomSpec[], o: HubOpts): Built | null {
  const { g } = c, h = o.court >> 1, H = h + o.arm, D = 2 * h + o.arm + SHOULDER - 1, n0 = g.regions.length;
  if (h < 5 || o.arm < 5 || s.reach - H < 8) return null;
  const court = g.hall('plaza', 'market');
  g.street(court, -h, -h, h, h);
  // The spokes and the road round the market are one hall: each spoke runs from the court through the ring's inner wall.
  const streets = g.hall('hall');
  for (const f of SPOKE) g.street(streets, ...rect(f, h, s.reach, -1, 1));
  // The market, a quadrant at a time, in the north-east one's terms: n tiles north of the middle and e east of it.
  // North of the court stands one room with the cut corner; east of it a second (with fewer rooms than eight, that
  // ground is the first one's too).
  const stalls = [...market], own = Math.max(0, Math.min(4, stalls.length - 4));
  for (const [i, k] of shuffle(c.rng, [0, 1, 2, 3]).entries()) {
    const big = stalls.shift(), small = i < own ? stalls.shift() : undefined;
    // The second room first: the wall between the two is its own, in line with the court's side, and the first
    // room's cut corner starts clear of it.
    const b = small ? g.room(small.role, { spec: small, access: [court, streets] }) : -1;
    const a = big ? g.room(big.role, { spec: big, access: [court, streets] }) : g.room('garden', { dept: 'market', access: [court, streets] });
    for (let n = 1; n < H; n++) for (let e = 1; e < H; e++) {
      if ((n < h && e < h) || n + e >= D) continue;
      const [x, y] = turn(k, e, -1 - n);
      if (!c.free(x, y)) return null;
      g.set(x, y, n >= h || b < 0 ? a : b);
    }
  }
  // The road: two tiles round the market's outline, its cut corners included, with its own margin against open space.
  const road: [number, number][] = [];
  for (let k = 0; k < 4; k++) for (let n = 0; n < H + 2; n++) for (let e = 0; e < H + 2; e++) {
    if ((n < H && e < H && n + e < D) || n + e >= D + 2) continue;
    const [x, y] = turn(k, e, -1 - n);
    if (g.at(x, y) === streets) continue;
    if (!c.free(x, y)) return null;
    road.push([x, y]);
  }
  for (const [x, y] of road) g.set(x, y, streets);
  for (const [x, y] of road) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (g.at(x + dx, y + dy) === SPACE) g.set(x + dx, y + dy, SOLID);
  // A lane is one side of one spoke, beyond the road. The rooms go biggest first, each to the lane with the least in
  // it, so every spoke carries about the same. A room and its annex are one unit.
  const lanes = shuffle(c.rng, SPOKE.flatMap((f) => ([-1, 1] as const).map((side) => {
    const axis: 'x' | 'y' = f.dir === 'e' || f.dir === 'w' ? 'x' : 'y', dir: 1 | -1 = f.dir === 'e' || f.dir === 's' ? 1 : -1, across = axis === 'x' ? f.y : f.x;
    return { axis, dir, side, at: (axis === 'x' ? f.x : f.y) + dir * (H + 2), edge: side < 0 ? across - 2 : across + 1, units: [] as RoomSpec[][], len: 0 };
  })));
  type Lane = (typeof lanes)[number];
  // One unit at a lane's end. Against the ring it shares the ring's inner wall or stands two tiles clear of it or
  // more: never a second wall beside that one, never a one-tile slit.
  const B = s.reach + 2;
  const put = (l: Lane, unit: RoomSpec[], o: { access: number[]; floorDepth?: number }): boolean => {
    const m = g.mark(), first = g.regions.length, before = g.blocks(-B, -B, B, B);
    const r = line(c.site, unit, l.axis, l.dir, l.at, l.edge, l.side, { ...o, free: c.free });
    let ok = r.rest.length === 0 && g.blocks(-B, -B, B, B) <= before;
    for (let y = -B; y < B && ok; y++) for (let x = -B; x < B && ok; x++) {
      if (g.at(x, y) < first) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const far = g.at(x + 2 * dx, y + 2 * dy);
        if (g.at(x + dx, y + dy) === SPACE && far !== SPACE && far < first) ok = false;
      }
    }
    if (!ok) { g.reset(m); return false; }
    l.at = r.at;
    return true;
  };
  // Market rooms past the eight round the court head the lanes.
  for (const [i, r] of stalls.entries()) if (!put(lanes[i % lanes.length] as Lane, [r], { access: [streets], floorDepth: 4 })) return null;
  for (const l of lanes) l.len = Math.abs(l.at);
  for (const r of [...rooms].sort((a, b) => b.w * b.h - a.w * a.h).map(long)) {
    const lane = lanes.reduce((p, q) => (q.len < p.len ? q : p));
    lane.units.push([r, ...(r.annex ? [{ ...long(r.annex), annexed: true }] : [])]);
    lane.len += r.w + 1 + (r.annex ? Math.max(r.annex.w, r.annex.h) + 1 : 0);
  }
  // Each lane takes its own; what one cannot hold goes to whichever lane has the most room left,
  const over: RoomSpec[][] = [];
  for (const l of lanes) for (const unit of l.units) if (!put(l, unit, { access: [streets] })) over.push(unit);
  // As it is, else reshaped to a depth that fits (a room keeps its area).
  const shapes = [undefined, 6, 7, 8];
  for (const unit of over) if (!shapes.some((d) => [...lanes].sort((p, q) => Math.abs(p.at) - Math.abs(q.at)).some((l) => put(l, unit, { access: [streets], ...(d ? { floorDepth: d } : {}) })))) return null;
  const regions: number[] = [];
  for (let id = n0; id < g.regions.length; id++) regions.push(id);
  return { ports: [], regions, box: [-s.reach, -s.reach, s.reach, s.reach] };
}
