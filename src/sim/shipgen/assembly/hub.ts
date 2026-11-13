import type { RoomSpec } from '../plan';
import { shuffle } from '../civilKit';
import { line, type Site } from './lattice';
import { at, rect, type Built, type Ctx, type Frame } from './model';
import { cabinsWithin } from './quarters';
import { SOLID, SPACE } from './regions';

/**
 * The hub: what stands inside a ring. A market at the centre, a disc: a square court, the market's rooms round it
 * (one either side of each spoke, out to the disc's rim), and a ring road round the lot. A spoke runs from each side of
 * the court through the market and the road to the ring, and the other rooms the hub takes line the spokes beyond the
 * road: the gated ones on the north and south spokes, a gate at either end of each, the rest on the east and west
 * spokes (the main axis). The first room of each line runs in to the road, so its near side follows the curve. The
 * ground between the spokes stays open to space.
 *
 * Behind the gates it holds everything it is given, or the ring's size answers for it (the assembler tries the next
 * one); of the rest it holds what fits and leaves the others to the ring's band.
 */
export interface HubOpts {
  /** The court's side in tiles (even). */
  court: number;
  /** How far the market's rooms stand out from the court, walls included. */
  arm: number;
  /** One floor depth for the rooms behind the gates: a slab either side of the spoke (a room keeps its area). */
  slab?: number;
  /** The share of the quarters that may stand on the open spokes, as rows of cabins (default: all that fit). */
  cabins?: number;
}

/** A spoke's frame at the centre: u runs out along its axis, and the tile at u is u tiles from the middle. */
const SPOKE: readonly Frame[] = [{ x: 0, y: -1, dir: 'n' }, { x: 0, y: 0, dir: 'e' }, { x: 0, y: 0, dir: 's' }, { x: -1, y: 0, dir: 'w' }];
/** A quarter turn clockwise about the middle, `k` times: the north-east quadrant laid on each of the four. */
const turn = (k: number, x: number, y: number): [number, number] => { for (; k > 0; k--) [x, y] = [-1 - y, x]; return [x, y]; };
/** Road tiles round a market tile: within two tiles of it, so the road is two wide on the straight and on the curve. */
const ROAD: readonly (readonly [number, number])[] = [[1, 0], [2, 0], [-1, 0], [-2, 0], [0, 1], [0, 2], [0, -1], [0, -2], [1, 1], [1, -1], [-1, 1], [-1, -1]];

const long = (r: RoomSpec): RoomSpec => (r.w >= r.h ? r : { ...r, w: r.h, h: r.w });

export function hub(c: Ctx, s: Site, market: readonly RoomSpec[], rooms: { open: readonly RoomSpec[]; gated: readonly RoomSpec[] }, o: HubOpts): Built | null {
  const { g } = c, h = o.court >> 1, H = h + o.arm, n0 = g.regions.length;
  if (h < 5 || o.arm < 5 || s.reach - H < 8) return null;
  const court = g.hall('plaza', 'market');
  g.street(court, -h, -h, h, h);
  // The spokes and the road round the market are one hall: each spoke runs from the court through the ring's inner
  // wall. A gated spoke (north and south, when there are rooms to keep behind gates) stops at that wall.
  const streets = g.hall('hall');
  const gated = (f: Frame): boolean => rooms.gated.length > 0 && (f.dir === 'n' || f.dir === 's');
  for (const f of SPOKE) g.street(streets, ...rect(f, h, gated(f) ? s.reach - 1 : s.reach, -1, 1));
  // The market, a quadrant at a time, in the north-east one's terms: n tiles north of the middle and e east of it.
  // The market's rim is a circle of radius H about the middle: a row n runs east to rim(n), never fewer than three
  // tiles, so the wall along a spoke meets a flat. North of the court stands one room; east of it a second (with
  // fewer rooms than eight, that ground is the first one's too).
  const rim = (n: number): number => Math.max(3, Math.floor(Math.sqrt(H * H - (n + 0.5) ** 2) - 0.5));
  const sold: [number, number][] = [];
  const stalls = [...market], own = Math.max(0, Math.min(4, stalls.length - 4));
  for (const [i, k] of shuffle(c.rng, [0, 1, 2, 3]).entries()) {
    const big = stalls.shift(), small = i < own ? stalls.shift() : undefined;
    // The second room first: the wall between the two is its own, in line with the court's side. The two rows of the
    // first room above that wall run as far as it does, so the wall never runs into a step of the rim.
    const b = small ? g.room(small.role, { spec: small, access: [court, streets] }) : -1;
    const a = big ? g.room(big.role, { spec: big, access: [court, streets] }) : g.room('garden', { dept: 'market', access: [court, streets] });
    for (let n = 1; n < H; n++) for (let e = 1; e < H; e++) {
      if (n < h && e < h) continue;
      if (!(e <= rim(n) || n <= rim(e) || (b >= 0 && (n === h || n === h + 1) && e <= rim(h - 1)))) continue;
      const [x, y] = turn(k, e, -1 - n);
      if (!c.free(x, y)) return null;
      g.set(x, y, n >= h || b < 0 ? a : b);
      sold.push([x, y]);
    }
  }
  // The road: two tiles round the market's rim, with its own margin against open space.
  const road: [number, number][] = [];
  for (const [mx, my] of sold) for (const [dx, dy] of ROAD) {
    const x = mx + dx, y = my + dy;
    if (g.at(x, y) >= 0 || road.some(([p, q]) => p === x && q === y)) continue;
    if (!c.free(x, y)) return null;
    road.push([x, y]);
  }
  for (const [x, y] of road) g.set(x, y, streets);
  for (const [x, y] of road) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (g.at(x + dx, y + dy) === SPACE) g.set(x + dx, y + dy, SOLID);
  // A gate either end of a gated spoke: across it beyond the road, and in the ring's inner wall.
  for (const f of SPOKE.filter(gated)) {
    for (const v of [-1, 0]) g.set(...at(f, H + 2, v), SOLID);
    g.gate(...at(f, H + 2, 0));
    g.gate(...at(f, s.reach - 1, 0));
  }
  // A lane is one side of one spoke, beyond the road (and the gate).
  const lanes = shuffle(c.rng, SPOKE.flatMap((f) => ([-1, 1] as const).map((side) => {
    const axis: 'x' | 'y' = f.dir === 'e' || f.dir === 'w' ? 'x' : 'y', dir: 1 | -1 = f.dir === 'e' || f.dir === 's' ? 1 : -1, across = axis === 'x' ? f.y : f.x;
    const from = axis === 'x' ? f.x : f.y, u0 = H + (gated(f) ? 3 : 2);
    return { axis, dir, side, gated: gated(f), from, u0, at: from + dir * u0, edge: side < 0 ? across - 2 : across + 1, len: 0, done: [] as { specs: RoomSpec[]; access: number[] }[] };
  })));
  type Lane = (typeof lanes)[number];
  const laid = g.mark();
  // One unit at a lane's end. Against the ring it shares the ring's inner wall or stands two tiles clear of it or
  // more: never a second wall beside that one, never a one-tile slit.
  const B = s.reach + 2;
  const put = (l: Lane, unit: RoomSpec[], o: { access: number[]; floorDepth?: number }): boolean => {
    const m = g.mark(), first = g.regions.length, before = g.blocks(-B, -B, B, B);
    const specs: RoomSpec[] = [];
    const r = line(c.site, unit, l.axis, l.dir, l.at, l.edge, l.side, { ...o, free: c.free, placed: specs });
    // A lane's first room runs in to the road, which curves away from its near wall: each row of the room across the
    // lane runs in as far as the ground is free. Its last two rows stop level with the one before them and the road
    // takes the rest, so the room's far wall meets a flat of the road, never a step.
    if (l.done.length === 0) {
      const tile = (u: number, v: number): [number, number] => (l.axis === 'x' ? [u, v] : [v, u]);
      const rows: number[] = [], wide: [number, number][] = [];
      for (let v = l.edge; g.at(...tile(l.at, v)) === first; v += l.side) {
        let n = 0;
        while (n < l.u0 && c.free(...tile(l.at - l.dir * (n + 1), v))) n++;
        rows.push(n);
      }
      for (const [i, n] of rows.entries()) {
        const keep = i >= rows.length - 2 ? Math.min(n, rows[rows.length - 3] ?? 0) : n;
        for (let k = 1; k <= n; k++) {
          const t = tile(l.at - l.dir * k, l.edge + l.side * i);
          g.set(...t, k <= keep ? first : streets);
          if (k > keep) wide.push(t);
        }
      }
      for (const [x, y] of wide) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (g.at(x + dx, y + dy) === SPACE) g.set(x + dx, y + dy, SOLID);
    }
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
    l.done.push({ specs, access: o.access });
    return true;
  };
  const open = lanes.filter((l) => !l.gated), shut = lanes.filter((l) => l.gated);
  // Market rooms past the eight round the court head the open lanes.
  for (const [i, r] of stalls.entries()) if (!put(open[i % open.length] as Lane, [r], { access: [streets], floorDepth: 4 })) return null;
  // The rooms go biggest first, each to the lane of its kind with the least in it, so the spokes carry about the
  // same; what a lane cannot hold goes to whichever has the most room left, as it is, else reshaped to a depth that
  // fits (a room keeps its area). A room and its annex are one unit; quarters stand as a row of cabins.
  const deal = (list: readonly RoomSpec[], to: Lane[], depth?: number): RoomSpec[] => {
    for (const l of to) l.len = Math.abs(l.at);
    const dealt = new Map<Lane, { spec: RoomSpec; unit: RoomSpec[] }[]>(to.map((l) => [l, []]));
    for (const spec of [...list].sort((p, q) => q.w * q.h - p.w * p.h)) {
      const r = long(spec), unit = r.annex ? [r, { ...long(r.annex), annexed: true }] : cabinsWithin(r);
      const lane = to.reduce((p, q) => (q.len < p.len ? q : p));
      dealt.get(lane)?.push({ spec, unit });
      lane.len += unit.reduce((n, u) => n + (depth ? Math.max(3, Math.ceil((u.w * u.h) / depth)) : u.w) + 1, 0);
    }
    const over: { spec: RoomSpec; unit: RoomSpec[] }[] = [];
    for (const [l, units] of dealt) for (const u of units) if (!put(l, u.unit, { access: [streets], ...(depth ? { floorDepth: depth } : {}) })) over.push(u);
    const shapes = depth ? [depth, depth + 1, depth - 1] : [undefined, 6, 7, 8];
    return over.filter((u) => !shapes.some((d) => [...to].sort((p, q) => Math.abs(p.at) - Math.abs(q.at)).some((l) => put(l, u.unit, { access: [streets], ...(d ? { floorDepth: d } : {}) })))).map((u) => u.spec);
  };
  // Behind the gates everything must stand; of the rest, what the open spokes cannot hold is left to the ring's band,
  // and of the quarters only their share is offered.
  if (shut.length > 0 && deal(rooms.gated, shut, o.slab).length > 0) return null;
  const blocks = rooms.open.filter((r) => r.role === 'quarters'), most = Math.ceil(blocks.length * (o.cabins ?? 1));
  const left = [...blocks.slice(most), ...deal(rooms.open.filter((r) => !blocks.slice(most).includes(r)), open)];
  // No bare spoke between a lane's last rooms and the ring: laid again as they came out, with the last room of each
  // lane run on to the ring's inner wall, which becomes its own (a row of cabins shares the length out). Where the
  // ring's inner side is not straight across the room, it stays as it was.
  const plan = lanes.map((l) => l.done);
  g.reset(laid);
  for (const [i, l] of lanes.entries()) {
    l.at = l.from + l.dir * l.u0;
    l.done = [];
    for (const [k, rec] of (plan[i] as Lane['done']).entries()) {
      const end = (l.at - l.from) * l.dir + rec.specs.reduce((n, r) => n + r.w + 1, 1), extra = s.reach - end;
      let grown: RoomSpec[] | null = null;
      if (k === (plan[i] as Lane['done']).length - 1 && extra > 0) {
        const cabins = rec.specs.every((r) => r.cabin), last = rec.specs.map((r) => !r.annexed).lastIndexOf(true);
        grown = rec.specs.map((r, j) => ({ ...r, w: r.w + (cabins ? Math.floor(extra / rec.specs.length) + (j < extra % rec.specs.length ? 1 : 0) : j === last ? extra : 0) }));
      }
      if (!(grown && put(l, grown, { access: rec.access })) && !put(l, rec.specs, { access: rec.access })) return null;
    }
  }
  const regions: number[] = [];
  for (let id = n0; id < g.regions.length; id++) regions.push(id);
  return { ports: [], regions, box: [-s.reach, -s.reach, s.reach, s.reach], ...(left.length > 0 ? { left } : {}) };
}
