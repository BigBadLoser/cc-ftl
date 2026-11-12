import { localBuilder } from './blocks';
import type { Builder } from './builder';
import type { RoomSpec } from './plan';
import type { Rng } from '../rng';
import { RegionGrid, SOLID, SPACE } from './stationRegions';

/**
 * Shared pieces of the flow stations (stationFlowWheel.ts, stationFlowSpine.ts): the lattice ring and band, rooms lining
 * a street, and the last steps before a layout is handed to the fit-out.
 *
 * The lattice band: hull and ring step K tiles at a time and the ring steps where the hull steps, so the band is cut
 * along the lattice into strips K wide and DEEP cells deep. Every band room is one or more whole strips: a rectangle
 * with straight walls all the way round the station, diagonals included, and no wall ever meets a one-tile stair.
 */

export const K = 4;
export const DEEP = 2;
/** A dock room's depth with its walls: hull row, six of floor, the inner wall. */
export const DOCK_DEPTH = 8;

export interface Built { b: Builder; left: number; spare: number; why: string }

interface Strip { face: 'n' | 'e' | 's' | 'w'; off: number; tiles: [number, number][]; full: boolean; angle: number }

export const cellOf = (x: number, y: number): [number, number] => [(Math.floor(x / K) + 0.5) * K, (Math.floor(y / K) + 0.5) * K];
const vertical = (x: number, y: number): boolean => { const [cx, cy] = cellOf(x, y); return Math.abs(cy) >= Math.abs(cx); };

/** The station's outline on the lattice: a stepped disc, or a square with its corners cut. */
export type Outline = 'disc' | 'square';
/** Cells cut from each corner of a square outline, along either side. */
export const CUT = 2;

/** The lattice shapes of a station of half-size R tiles: the hull, and the floor inboard of the band. */
function shapes(R: number, outline: Outline): { hull: (x: number, y: number) => boolean; inside: (x: number, y: number) => boolean } {
  const within = (cx: number, cy: number): boolean => (outline === 'disc' ? Math.hypot(cx, cy) < R : Math.max(Math.abs(cx), Math.abs(cy)) < R && Math.abs(cx) + Math.abs(cy) < 2 * R - K * CUT);
  const hull = (x: number, y: number): boolean => within(...cellOf(x, y));
  // A cell is inboard when the cell DEEP cells further out along its octant's axis is still hull: every strip is DEEP deep.
  const inner = (x: number, y: number): boolean => {
    const [cx, cy] = cellOf(x, y);
    return Math.abs(cy) >= Math.abs(cx) ? within(cx, cy + Math.sign(cy) * DEEP * K) : within(cx + Math.sign(cx) * DEEP * K, cy);
  };
  // At a step the divider between two strips runs straight from the hull's riser to the ring, so the ring's own riser
  // sits one tile nearer the axis than the lattice line (that one-tile column stays with the band).
  const inside = (x: number, y: number): boolean => inner(x, y) && (vertical(x, y) ? inner(x + Math.sign(x + 0.5), y) : inner(x, y + Math.sign(y + 0.5)));
  return { hull, inside };
}

/** A quarters block as one-bed cabins (the first takes the block's other pieces). */
export function cabinsOf(r: RoomSpec): RoomSpec[] {
  const beds = r.mods.filter((m) => m === 'module.bed').length;
  if (r.role !== 'quarters' || beds < 2) return [r];
  const others = r.mods.filter((m) => m !== 'module.bed');
  return Array.from({ length: beds }, (_, i): RoomSpec => ({ ...r, mods: ['module.bed', ...(i === 0 ? others : [])], w: 3, h: 6, cabin: true, cabins: false }));
}

/** Strips a band room needs: its shorter side across the strips when it fits the band's depth, else its longer. */
export const stripsFor = (r: RoomSpec): number => {
  const depth = DEEP * K - 2;
  const along = Math.max(r.w, r.h) <= depth ? Math.min(r.w, r.h) : Math.max(r.w, r.h);
  return Math.max(1, Math.ceil((along + 1) / K));
};

/** A lattice ring on its grid: the ring hall painted, its inner wall solid, everything inboard of that free ground. */
export interface Site {
  g: RegionGrid;
  R: number;
  outline: Outline;
  hull: (x: number, y: number) => boolean;
  inside: (x: number, y: number) => boolean;
  /** How far a tile is inside the inboard floor (0 outside it): 1-2 the ring, 3 its inner wall, more is free ground. */
  depth: (x: number, y: number) => number;
  ring: number;
  /** The last tile of free ground along an axis (the ring's inner wall). */
  reach: number;
  /** Free ground inboard of the ring: nothing painted there yet. */
  free: (x: number, y: number) => boolean;
  /** Free ground outside the ring (the band's zone and beyond the hull). */
  freeOut: (x: number, y: number) => boolean;
}

export function site(R: number, pad = 24, outline: Outline = 'disc'): Site {
  const g = new RegionGrid(R + pad);
  const { hull, inside } = shapes(R, outline);
  const memo = new Map<number, number>();
  const depth = (x: number, y: number): number => {
    const key = (y + 512) * 1024 + x + 512;
    let d = memo.get(key);
    if (d !== undefined) return d;
    d = 4;
    if (!inside(x, y)) d = 0;
    else for (let r = 1; r <= 3 && d === 4; r++) for (let dy = -r; dy <= r && d === 4; dy++) for (let dx = -r; dx <= r && d === 4; dx++) if (!inside(x + dx, y + dy)) d = r;
    memo.set(key, d);
    return d;
  };
  const ring = g.hall();
  g.paint(ring, (x, y) => { const d = depth(x, y); return d === 1 || d === 2; });
  g.paint(SOLID, (x, y) => depth(x, y) === 3);
  let reach = 0;
  while (depth(0, -(reach + 1)) >= 3) reach++;
  const open = (x: number, y: number): boolean => g.at(x, y) === SPACE || g.at(x, y) === SOLID;
  return { g, R, outline, hull, inside, depth, ring, reach, free: (x, y) => depth(x, y) >= 3 && open(x, y), freeOut: (x, y) => depth(x, y) === 0 && open(x, y) };
}

export interface LineOpts {
  /** Regions the rooms may open onto (default: any hall). */
  access?: number[];
  /** The short side on the street (street frontage is what runs out first). */
  deep?: boolean;
  /** One depth for the whole line (floor tiles): a room keeps its area, so a shallower one gets shorter. */
  floorDepth?: number;
  free?: (x: number, y: number) => boolean;
  /** Collects the specs as placed (reshaped ones included). */
  placed?: RoomSpec[];
}

/**
 * Rooms lining a street: from `from` outward along `axis` (direction `dir`), on the side `side` of the street's margin
 * `edge`. A room is its floor, one wall along the line and two across it; the first also brings its own near wall when
 * it starts against a hall or open space. A line stops at the first room that will not fit; it returns the rest and where it stopped.
 */
export function line(s: Site, specs: RoomSpec[], axis: 'x' | 'y', dir: 1 | -1, from: number, edge: number, side: 1 | -1, o: LineOpts = {}): { rest: RoomSpec[]; at: number } {
  const { g } = s, free = o.free ?? s.free;
  let at = from;
  for (const [i, room] of specs.entries()) {
    let spec = o.deep && room.w > room.h ? { ...room, w: room.h, h: room.w } : room;
    if (o.floorDepth && spec.role !== 'dock') spec = { ...spec, w: Math.max(3, Math.ceil((spec.w * spec.h) / o.floorDepth)), h: o.floorDepth };
    const across = spec.h + 2, c0 = Math.min(edge, edge + side * (across - 1)), c1 = Math.max(edge, edge + side * (across - 1)) + 1;
    // Its own near wall when what stands before it would take a tile from it: a hall, or open space.
    let ownWall = false;
    for (let c = c0; c < c1 && !ownWall; c++) { const b = axis === 'x' ? g.at(at - dir, c) : g.at(c, at - dir); ownWall = b === SPACE || (b >= 0 && !!g.regions[b]?.hall); }
    const along = spec.w + 1 + (ownWall ? 1 : 0);
    const a0 = Math.min(at, at + dir * (along - 1)), a1 = Math.max(at, at + dir * (along - 1)) + 1;
    const [x0, y0, x1, y1] = axis === 'x' ? [a0, c0, a1, c1] : [c0, a0, c1, a1];
    let fits = true;
    for (let y = y0; y < y1 && fits; y++) for (let x = x0; x < x1 && fits; x++) fits = free(x, y);
    if (!fits) return { rest: specs.slice(i), at };
    g.rect(g.room(spec.role, { spec, doors: spec.warehouse ? 2 : 1, ...(o.access ? { access: o.access } : {}) }), x0, y0, x1, y1);
    at += dir * along;
    o.placed?.push(spec);
  }
  return { rest: [], at };
}

/** The band's strips still open to space, folded (a strip with no ring frontage joins its neighbour) and in clockwise order from north. */
function stripsOf(s: Site): Strip[] {
  const { g, R, hull, inside, ring } = s;
  const strips = new Map<string, Strip>();
  for (let y = -R; y < R; y++) for (let x = -R; x < R; x++) {
    if (!hull(x, y) || inside(x, y) || g.at(x, y) !== SPACE) continue;
    const [cx, cy] = cellOf(x, y), v = Math.abs(cy) >= Math.abs(cx);
    const face = v ? (cy < 0 ? 'n' : 's') : cx > 0 ? 'e' : 'w', off = v ? cx : cy;
    const key = `${face}${off}`;
    if (!strips.has(key)) strips.set(key, { face, off, tiles: [], full: false, angle: 0 });
    (strips.get(key) as Strip).tiles.push([x, y]);
  }
  // A full strip is whole (or nearly: a wing's wall may take a row) and fronts the ring along at least three tiles,
  // enough for a door; the corner strips where two faces meet often front another strip instead.
  const inward: Record<Strip['face'], [number, number]> = { n: [0, 1], s: [0, -1], e: [-1, 0], w: [1, 0] };
  for (const st of strips.values()) {
    const [dx, dy] = inward[st.face];
    const front = st.tiles.filter(([x, y]) => g.at(x + dx, y + dy) === ring).length;
    st.full = st.tiles.length >= DEEP * K * K - K && front >= 3;
  }
  // A strip that is not full joins the strip beside it on its face: the one towards the axis (corner strips fold
  // inward one after another, farthest first, until they reach a full one), else the one away from it (the pieces a
  // concourse or a spine leaves either side of itself). One with no neighbour at all stays open space, a notch.
  for (const st of [...strips.values()].filter((q) => !q.full).sort((p, q) => Math.abs(q.off) - Math.abs(p.off))) {
    const step = Math.sign(st.off) * K;
    const towards = strips.get(`${st.face}${st.off - step}`), away = strips.get(`${st.face}${st.off + step}`);
    const host = towards && Math.sign(towards.off) === Math.sign(st.off) ? towards : away?.full ? away : undefined;
    if (host) host.tiles.push(...st.tiles);
    strips.delete(`${st.face}${st.off}`);
  }
  // A tongue: a tile with the ring on one side and another strip straight across from it. Where the ring turns a
  // corner it leaves one row of a strip under its neighbour; that row is the neighbour's wall onto the ring, or the two
  // of them build a wall each, side by side.
  const owner = new Map<number, Strip>();
  const at = (x: number, y: number): number => (y + 1024) * 4096 + x + 1024;
  for (const st of strips.values()) for (const [x, y] of st.tiles) owner.set(at(x, y), st);
  const roomAt = (x: number, y: number): number => { const a = g.at(x, y); return a >= 0 && !g.regions[a]?.hall ? a : -1; };
  for (const st of [...strips.values()]) {
    st.tiles = st.tiles.filter(([x, y]) => {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        if (g.at(x + dx, y + dy) !== ring) continue;
        const across = owner.get(at(x - dx, y - dy)), room = roomAt(x - dx, y - dy);
        if (across && across !== st) { across.tiles.push([x, y]); owner.set(at(x, y), across); return false; }
        // The same beside a room that stands in the band's depth (a wing's): the tile is that room's wall.
        if (!across && room >= 0) { g.set(x, y, room); owner.delete(at(x, y)); return false; }
      }
      return true;
    });
  }
  // A sliver: strip tiles in a run under three wide, left beside a room that is not the band's (a wing crossing the
  // lattice off its lines). It could only ever be wall, two thick with the room's own, so it joins that room.
  for (let again = true; again;) {
    again = false;
    for (const st of strips.values()) {
      st.tiles = st.tiles.filter(([x, y]) => {
        for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
          let lo = 0, hi = 0;
          while (owner.get(at(x - (lo + 1) * dx, y - (lo + 1) * dy)) === st) lo++;
          while (owner.get(at(x + (hi + 1) * dx, y + (hi + 1) * dy)) === st) hi++;
          if (lo + hi + 1 >= 3) continue;
          const room = [roomAt(x - (lo + 1) * dx, y - (lo + 1) * dy), roomAt(x + (hi + 1) * dx, y + (hi + 1) * dy)].find((r) => r >= 0);
          if (room === undefined) continue;
          for (let k = -lo; k <= hi; k++) { g.set(x + k * dx, y + k * dy, room); owner.delete(at(x + k * dx, y + k * dy)); }
          again = true;
          return false;
        }
        return true;
      }).filter(([x, y]) => owner.get(at(x, y)) === st);
    }
  }
  const order = [...strips.values()].filter((st) => st.tiles.length > 0);
  for (const st of order) {
    const mx = st.tiles.reduce((t, p) => t + p[0], 0) / st.tiles.length, my = st.tiles.reduce((t, p) => t + p[1], 0) / st.tiles.length;
    st.angle = (Math.atan2(mx, -my) + 2 * Math.PI) % (2 * Math.PI); // 0 = north, clockwise
  }
  return order.sort((a, c) => a.angle - c.angle);
}

/**
 * A strip gives way on its side away from the axis (the nearer the axis, the lower the rank), so every strip keeps its
 * width and a hull step's riser runs straight on as the divider below it.
 */
const rankOf = (st: Strip): number => Math.abs(st.off) + (st.face === 'e' || st.face === 'w' ? 0.5 : 0);

/** A place for one band room: one strip, or the two strips either side of a face's axis (which must be one room). */
export interface BandUnit { face: Strip['face']; tiles: [number, number][]; strips: 1 | 2; angle: number; rank: number; side: number; used: boolean }

/** The band as units in clockwise order from north (stationFlow planner: rooms are placed on them by department). */
export function bandUnits(s: Site): BandUnit[] {
  const order = stripsOf(s).filter((st) => st.full);
  const out: BandUnit[] = [];
  for (let i = 0; i < order.length; i++) {
    const st = order[i] as Strip, next = order[i + 1];
    if (Math.abs(st.off) === K / 2 && next && next.face === st.face && Math.abs(next.off) === K / 2 && next.off !== st.off) {
      out.push({ face: st.face, tiles: [...st.tiles, ...next.tiles], strips: 2, angle: (st.angle + next.angle) / 2, rank: rankOf(st), side: 0, used: false });
      i++;
    } else out.push({ face: st.face, tiles: st.tiles, strips: 1, angle: st.angle, rank: rankOf(st), side: Math.sign(st.off), used: false });
  }
  return out;
}

/**
 * Fill the band: every strip of the lattice between hull and ring that is still open space becomes a room. Cabins take
 * one strip each; an `others` room takes as many as its size needs, on one face and one side of its axis. Both lists are
 * consumed; what is left in them did not fit. Returns the strips given to no room (planter nooks).
 */
export function fillBand(s: Site, cabins: RoomSpec[], others: RoomSpec[]): number {
  const { g } = s;
  const order = stripsOf(s);

  let spare = 0;
  const bunks: RoomSpec[] = [];
  const give = (spec: RoomSpec | null, ss: Strip[]): void => {
    const rank = Math.min(...ss.map(rankOf));
    if (spec?.cabin) bunks.push(spec);
    const id = spec ? g.room(spec.role, { spec, rank }) : g.room('garden', { rank });
    for (const st of ss) for (const [x, y] of st.tiles) g.set(x, y, id);
    if (!spec) spare += ss.length;
  };
  const sameRun = (a: Strip, c: Strip | undefined): boolean => !!c && c.full && c.face === a.face && Math.sign(c.off) === Math.sign(a.off);
  let turn = 0;
  for (let i = 0; i < order.length;) {
    const st = order[i] as Strip, next = order[i + 1];
    // The two strips either side of an axis are one double room (when nothing runs between them).
    if (Math.abs(st.off) === K / 2 && next && next.face === st.face && next.full && st.full && Math.abs(next.off) === K / 2) {
      const k = others.findIndex((r) => stripsFor(r) <= 2);
      give(k >= 0 ? (others.splice(k, 1)[0] as RoomSpec) : (cabins.shift() ?? null), [st, next]);
      i += 2;
      continue;
    }
    let n = 1;
    while (sameRun(st, order[i + n])) n++;
    // Every third place (and once the cabins are out) goes to the biggest other room that fits the run from here.
    const k = turn++ % 3 === 0 || cabins.length === 0 ? others.findIndex((r) => stripsFor(r) <= n) : -1;
    const pick = k >= 0 ? (others.splice(k, 1)[0] as RoomSpec) : (cabins.shift() ?? null);
    const take = pick && !pick.cabin ? stripsFor(pick) : 1;
    give(pick, order.slice(i, i + take));
    i += take;
  }
  // A cabin or two over: they double up (a second bed in a cabin already placed) before the whole ring grows a step.
  if (others.length === 0 && cabins.length <= 2 && bunks.length >= cabins.length) {
    for (const [k, extra] of cabins.splice(0).entries()) (bunks[k] as RoomSpec).mods.push(...extra.mods);
  }
  return spare;
}

/** The last steps: nothing left over, every room walkable to (one stranded tile and the fit-out places nothing solid), then the stamp. */
export function finish(s: Site, rng: Rng, leftover: RoomSpec[], spare: number): Built {
  const b = localBuilder(rng);
  if (leftover.length > 0) return { b, left: leftover.length, spare, why: `short of ${leftover.map((r) => `${r.role} ${r.w}x${r.h}`).join(', ')}` };
  const cut = s.g.stranded();
  if (cut.length > 0) return { b, left: cut.length, spare, why: `no way in to ${cut.map(([x, y, id]) => `${s.g.regions[id]?.role} at ${x},${y}`).join('; ')}` };
  s.g.stamp(b);
  return { b, left: 0, spare, why: '' };
}
