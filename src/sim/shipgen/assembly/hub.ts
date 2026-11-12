import type { RoomSpec } from '../plan';
import { shuffle } from '../civilKit';
import { line, type Site } from './lattice';
import { rect, type Built, type Ctx, type Frame } from './model';
import { SPACE } from './regions';

/**
 * The hub: what stands inside a ring. A market court at the centre, a spoke from each of its sides to the ring, the
 * market's rooms either side of every spoke at the court (a cross, as wide as the court), and the other rooms it takes
 * lining the spokes beyond them. The ground between the spokes stays open to space.
 *
 * It holds what fits: a room that does not is the ring's size to answer for (the assembler tries the next one).
 */
export interface HubOpts {
  /** The court's side in tiles (even). The market's rooms are as deep as half of it leaves beside a spoke. */
  court: number;
}

/** A spoke's frame at the centre: u runs out along its axis, and the tile at u is u tiles from the middle. */
const SPOKE: readonly Frame[] = [{ x: 0, y: -1, dir: 'n' }, { x: 0, y: 0, dir: 'e' }, { x: 0, y: 0, dir: 's' }, { x: -1, y: 0, dir: 'w' }];

const long = (r: RoomSpec): RoomSpec => (r.w >= r.h ? r : { ...r, w: r.h, h: r.w });

export function hub(c: Ctx, s: Site, market: readonly RoomSpec[], rooms: readonly RoomSpec[], o: HubOpts): Built | null {
  const { g } = c, h = o.court >> 1, depth = h - 3, n0 = g.regions.length;
  if (depth < 3 || s.reach - h < 6) return null;
  const court = g.hall('plaza', 'market');
  g.street(court, -h, -h, h, h);
  // The spokes are one hall: each runs from the court through the ring's inner wall.
  const spokes = g.hall('hall');
  for (const f of SPOKE) g.street(spokes, ...rect(f, h, s.reach, -1, 1));
  // A lane is one side of one spoke. Market rooms are dealt round the lanes; the rest go biggest first, each to the
  // lane with the least in it, so every spoke carries about the same. A room and its annex are one unit.
  const lanes = shuffle(c.rng, SPOKE.flatMap((f) => ([-1, 1] as const).map((side) => {
    const axis: 'x' | 'y' = f.dir === 'e' || f.dir === 'w' ? 'x' : 'y', dir: 1 | -1 = f.dir === 'e' || f.dir === 's' ? 1 : -1, across = axis === 'x' ? f.y : f.x;
    return { axis, dir, side, at: (axis === 'x' ? f.x : f.y) + dir * h, edge: side < 0 ? across - 2 : across + 1, units: [] as RoomSpec[][], len: 0 };
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
  for (const [i, r] of market.entries()) if (!put(lanes[i % lanes.length] as Lane, [r], { access: [court, spokes], floorDepth: depth })) return null;
  for (const l of lanes) l.len = Math.abs(l.at);
  for (const r of [...rooms].sort((a, b) => b.w * b.h - a.w * a.h).map(long)) {
    const lane = lanes.reduce((p, q) => (q.len < p.len ? q : p));
    lane.units.push([r, ...(r.annex ? [{ ...long(r.annex), annexed: true }] : [])]);
    lane.len += r.w + 1 + (r.annex ? Math.max(r.annex.w, r.annex.h) + 1 : 0);
  }
  // Each lane takes its own; what one cannot hold goes to whichever lane has the most room left,
  const over: RoomSpec[][] = [];
  for (const l of lanes) for (const unit of l.units) if (!put(l, unit, { access: [spokes] })) over.push(unit);
  // As it is, else reshaped to a depth that fits (a room keeps its area).
  const shapes = [undefined, 6, 7, 8];
  for (const unit of over) if (!shapes.some((d) => [...lanes].sort((p, q) => Math.abs(p.at) - Math.abs(q.at)).some((l) => put(l, unit, { access: [spokes], ...(d ? { floorDepth: d } : {}) })))) return null;
  const regions: number[] = [];
  for (let id = n0; id < g.regions.length; id++) regions.push(id);
  return { ports: [], regions, box: [-s.reach, -s.reach, s.reach, s.reach] };
}
