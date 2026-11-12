import { localBuilder } from './blocks';
import type { Builder } from './builder';
import type { RoomSpec } from './plan';
import type { Rng } from '../rng';
import { isDock } from './stationDepartments';
import { RegionGrid, SOLID, SPACE } from './stationRegions';
import { SHOP } from './stationRings';

/**
 * The flow wheel: the trading flow "harbour and market" (docs/STATIONFLOWS.md) as a round station whose size follows
 * from its program. One pass per candidate radius, smallest first; the first that places every room is kept.
 *
 *   harbour    a dock wing on the north flat; its only link to the station is the concourse, through a customs gate
 *   commons    a court at the centre, shops lining the streets where they leave it
 *   freight    warehouses on the east street
 *   secure     the west street behind a gate, not joined to the ring: machine rooms open onto it and nowhere else
 *   the band   cabins and the smaller rooms against the hull, on a lattice (below)
 *
 * The lattice band: hull and ring step K tiles at a time and the ring steps where the hull steps, so the band is cut
 * along the lattice into strips K wide and DEEP cells deep. Every band room is one or more whole strips: a rectangle
 * with straight walls all the way round the station, diagonals included, and no wall ever meets a one-tile stair.
 */

const K = 4;
const DEEP = 2;
/** A dock room's depth with its walls: hull row, six of floor, the lobby wall. */
const DOCK_DEPTH = 8;
/** Concourse columns (3 wide) and street rows / spoke columns (2 wide). */
const CON = [-1, 2] as const;
const ST = [-1, 1] as const;
/** The court: its sides sit one shop's depth from the concourse, so the shops' back walls and its own line up. */
const COURT = { x0: CON[0] - SHOP.depth - 1, y0: -5, x1: CON[1] + SHOP.depth + 1, y1: 6 };

export interface FlowWheel { b: Builder; label: string }

interface Strip { face: 'n' | 'e' | 's' | 'w'; off: number; tiles: [number, number][]; full: boolean; angle: number }

const cellOf = (x: number, y: number): [number, number] => [(Math.floor(x / K) + 0.5) * K, (Math.floor(y / K) + 0.5) * K];
const vertical = (x: number, y: number): boolean => { const [cx, cy] = cellOf(x, y); return Math.abs(cy) >= Math.abs(cx); };

/** The lattice shapes of a wheel of radius R tiles: the hull disc, and the floor inboard of the band. */
function shapes(R: number): { hull: (x: number, y: number) => boolean; inside: (x: number, y: number) => boolean } {
  const hull = (x: number, y: number): boolean => { const [cx, cy] = cellOf(x, y); return Math.hypot(cx, cy) < R; };
  // A cell is inboard when the cell DEEP cells further out along its octant's axis is still hull: every strip is DEEP deep.
  const inner = (x: number, y: number): boolean => {
    const [cx, cy] = cellOf(x, y);
    return Math.abs(cy) >= Math.abs(cx) ? Math.hypot(cx, cy + Math.sign(cy) * DEEP * K) < R : Math.hypot(cx + Math.sign(cx) * DEEP * K, cy) < R;
  };
  // At a step the divider between two strips runs straight from the hull's riser to the ring, so the ring's own riser
  // sits one tile nearer the axis than the lattice line (that one-tile column stays with the band).
  const inside = (x: number, y: number): boolean => inner(x, y) && (vertical(x, y) ? inner(x + Math.sign(x + 0.5), y) : inner(x, y + Math.sign(y + 0.5)));
  return { hull, inside };
}

/** A quarters block as one-bed cabins (the first takes the block's other pieces). */
function cabinsOf(r: RoomSpec): RoomSpec[] {
  const beds = r.mods.filter((m) => m === 'module.bed').length;
  if (r.role !== 'quarters' || beds < 2) return [r];
  const others = r.mods.filter((m) => m !== 'module.bed');
  return Array.from({ length: beds }, (_, i): RoomSpec => ({ ...r, mods: ['module.bed', ...(i === 0 ? others : [])], w: 3, h: 6, cabin: true, cabins: false }));
}

/** Strips a band room needs: its shorter side across the strips when it fits the band's depth, else its longer. */
const stripsFor = (r: RoomSpec): number => {
  const depth = DEEP * K - 2;
  const along = Math.max(r.w, r.h) <= depth ? Math.min(r.w, r.h) : Math.min(r.w, r.h) <= depth ? Math.max(r.w, r.h) : Math.max(r.w, r.h);
  return Math.max(1, Math.ceil((along + 1) / K));
};

function build(rng: Rng, rooms: RoomSpec[], R: number, shops: number): { b: Builder; left: number; spare: number; why: string } {
  const g = new RegionGrid(R + 24);
  const { hull, inside } = shapes(R);
  // How far a tile is inside the inboard floor (0 outside it): 1-2 the ring, 3 its inner wall, more is free ground.
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
  const free = (x: number, y: number): boolean => depth(x, y) >= 3 && (g.at(x, y) === SPACE || g.at(x, y) === SOLID);

  // Streets. `reach`: the last tile of free ground along an axis (the ring's inner wall).
  let reach = 0;
  while (depth(0, -(reach + 1)) >= 3) reach++;
  const top = -R; // the hull's north flat: its first row of tiles
  const court = g.hall('plaza');
  const streets = g.hall();
  const secure = g.hall();
  g.street(streets, CON[0], top + 1, CON[1], COURT.y0);
  g.street(streets, COURT.x1, ST[0], reach + 1, ST[1]);
  g.street(streets, ST[0], COURT.y1, ST[1], reach + 1);
  g.street(court, COURT.x0, COURT.y0, COURT.x1, COURT.y1);
  // Secure: the west street stops at the ring's inner wall and does not pierce it; the court's own wall closes its east end but for one gate.
  g.street(secure, -(reach - 1), ST[0], COURT.x0 - 1, ST[1]);
  g.gate(COURT.x0 - 1, ST[0]);

  // The dock wing on the north flat: a lobby along the hull, the docks beyond it; the hull line under the lobby is
  // solid but for the customs gate where the concourse crosses it.
  const docks = rooms.filter(isDock);
  const half = Math.ceil((docks.length * K) / 2);
  const lobby = g.hall();
  g.street(lobby, -half, top - 3, half, top);
  // A dock is its airlock (the hull row and three tiles in) and clear floor between it and the door.
  const dockTop = top - 3 - DOCK_DEPTH;
  g.rect(SOLID, -half - 1, dockTop, -half, top - 3);
  g.rect(SOLID, half, dockTop, half + 1, top - 3);
  docks.forEach((spec, i) => g.rect(g.room('dock', { spec, access: [lobby] }), -half + i * K, dockTop, -half + (i + 1) * K, top - 3));
  g.gate(0, top);

  // Rooms lining a street: from `from` outward along `axis` (direction `dir`), on the side `side` of the street's
  // margin `edge`. A room is its floor, one wall along the line and two across it; the first also brings its own near
  // wall when it starts against a hall. A line stops at the first room that will not fit; it returns the rest.
  const line = (specs: RoomSpec[], axis: 'x' | 'y', dir: 1 | -1, from: number, edge: number, side: 1 | -1, access?: number[], deep = false): RoomSpec[] => {
    let at = from;
    for (const [i, room] of specs.entries()) {
      // `deep`: the short side on the street (street frontage is what runs out first).
      const spec = deep && room.w > room.h ? { ...room, w: room.h, h: room.w } : room;
      const across = spec.h + 2, c0 = Math.min(edge, edge + side * (across - 1)), c1 = Math.max(edge, edge + side * (across - 1)) + 1;
      const hallBefore = ((): boolean => {
        for (let c = c0; c < c1; c++) { const o = axis === 'x' ? g.at(at - dir, c) : g.at(c, at - dir); if (o >= 0 && g.regions[o]?.hall) return true; }
        return false;
      })();
      const along = spec.w + 1 + (hallBefore ? 1 : 0);
      const a0 = Math.min(at, at + dir * (along - 1)), a1 = Math.max(at, at + dir * (along - 1)) + 1;
      const [x0, y0, x1, y1] = axis === 'x' ? [a0, c0, a1, c1] : [c0, a0, c1, a1];
      let fits = true;
      for (let y = y0; y < y1 && fits; y++) for (let x = x0; x < x1 && fits; x++) fits = free(x, y);
      if (!fits) return specs.slice(i);
      g.rect(g.room(spec.role, { spec, doors: spec.warehouse ? 2 : 1, ...(access ? { access } : {}) }), x0, y0, x1, y1);
      at += dir * along;
    }
    return [];
  };

  const of = (pred: (r: RoomSpec) => boolean): RoomSpec[] => rooms.filter(pred);
  // A shop stands with its width along the street and its depth behind.
  const shop = (): RoomSpec => ({ role: 'shop', mods: [], w: SHOP.width, h: SHOP.depth, dept: 'commons' });
  const some = (n: number): RoomSpec[] => Array.from({ length: Math.max(0, n) }, shop);
  const quad = Math.ceil(shops / 4);
  const left: RoomSpec[] = [];
  // Commons: shops where the concourse and the south spoke leave the court; the office at the concourse's far end.
  const office = of((r) => r.role === 'bridge');
  left.push(...line([...some(quad), ...office], 'y', -1, COURT.y0 - 1, CON[0] - 1, -1));
  left.push(...line(some(quad), 'y', -1, COURT.y0 - 1, CON[1], 1));
  left.push(...line(some(quad), 'y', 1, COURT.y1, ST[0] - 1, -1));
  left.push(...line(some(shops - 3 * quad), 'y', 1, COURT.y1, ST[1], 1));
  // Freight: warehouses and the biggest holds on the east street, past the court's corner.
  const cargo = of((r) => r.role === 'cargo').sort((a, c) => c.w * c.h - a.w * a.h);
  const big = cargo.filter((r) => r.warehouse || stripsFor(r) > 3);
  left.push(...line(big.filter((_, i) => i % 2 === 0), 'x', 1, COURT.x1 + 1, ST[0] - 1, -1));
  left.push(...line(big.filter((_, i) => i % 2 === 1), 'x', 1, COURT.x1 + 1, ST[1], 1));
  // Secure: machine rooms on the west street, behind its gate; they open onto it and nowhere else.
  const machines = of((r) => ['reactor', 'shields', 'core'].includes(r.role)).sort((a, c) => c.w * c.h - a.w * a.h);
  left.push(...line(machines.filter((_, i) => i % 2 === 0), 'x', -1, COURT.x0 - 2, ST[0] - 1, -1, [secure], true));
  left.push(...line(machines.filter((_, i) => i % 2 === 1), 'x', -1, COURT.x0 - 2, ST[1], 1, [secure], true));
  if (left.length > 0) return { b: localBuilder(rng), left: left.length, spare: 0, why: `streets short of ${left.map((r) => `${r.role} ${r.w}x${r.h}`).join(', ')}` };

  // The band: strips of the lattice between hull and ring, by face and offset from the face's axis.
  const strips = new Map<string, Strip>();
  for (let y = -R; y < R; y++) for (let x = -R; x < R; x++) {
    if (!hull(x, y) || inside(x, y) || g.at(x, y) !== SPACE) continue;
    const [cx, cy] = cellOf(x, y), v = Math.abs(cy) >= Math.abs(cx);
    const face = v ? (cy < 0 ? 'n' : 's') : cx > 0 ? 'e' : 'w', off = v ? cx : cy;
    const key = `${face}${off}`;
    if (!strips.has(key)) strips.set(key, { face, off, tiles: [], full: false, angle: 0 });
    (strips.get(key) as Strip).tiles.push([x, y]);
  }
  // A full strip is whole (or nearly: the dock wing's wall takes a row) and fronts the ring along at least three
  // tiles, enough for a door; the corner strips where two faces meet often front another strip instead.
  const inward: Record<Strip['face'], [number, number]> = { n: [0, 1], s: [0, -1], e: [-1, 0], w: [1, 0] };
  for (const s of strips.values()) {
    const [dx, dy] = inward[s.face];
    const front = s.tiles.filter(([x, y]) => g.at(x + dx, y + dy) === ring).length;
    s.full = s.tiles.length >= DEEP * K * K - K && front >= 3;
  }
  // A strip that is not full joins the strip beside it on its face: the one towards the axis (corner strips fold
  // inward one after another, farthest first, until they reach a full one), else the one away from it (the pieces the
  // concourse leaves either side of itself). One with no neighbour at all stays open space, a notch in the hull.
  for (const s of [...strips.values()].filter((q) => !q.full).sort((p, q) => Math.abs(q.off) - Math.abs(p.off))) {
    const step = Math.sign(s.off) * K;
    const towards = strips.get(`${s.face}${s.off - step}`), away = strips.get(`${s.face}${s.off + step}`);
    const host = towards && Math.sign(towards.off) === Math.sign(s.off) ? towards : away?.full ? away : undefined;
    if (host) host.tiles.push(...s.tiles);
    strips.delete(`${s.face}${s.off}`);
  }
  const order = [...strips.values()];
  for (const s of order) {
    const mx = s.tiles.reduce((t, p) => t + p[0], 0) / s.tiles.length, my = s.tiles.reduce((t, p) => t + p[1], 0) / s.tiles.length;
    s.angle = (Math.atan2(mx, -my) + 2 * Math.PI) % (2 * Math.PI); // 0 = north, clockwise
  }
  order.sort((a, c) => a.angle - c.angle);

  const band = of((r) => !isDock(r) && r.role !== 'bridge' && !big.includes(r) && !machines.includes(r)).flatMap(cabinsOf);
  const cabins = band.filter((r) => r.cabin), others = band.filter((r) => !r.cabin).sort((a, c) => stripsFor(c) - stripsFor(a));
  let spare = 0;
  // A strip gives way on its side away from the axis (the nearer the axis, the lower the rank), so every strip keeps
  // its width and a hull step's riser runs straight on as the divider below it.
  const rankOf = (s: Strip): number => Math.abs(s.off) + (s.face === 'e' || s.face === 'w' ? 0.5 : 0);
  const bunks: RoomSpec[] = [];
  const give = (spec: RoomSpec | null, ss: Strip[]): void => {
    const rank = Math.min(...ss.map(rankOf));
    if (spec?.cabin) bunks.push(spec);
    const id = spec ? g.room(spec.role, { spec, rank }) : g.room('garden', { rank });
    for (const s of ss) for (const [x, y] of s.tiles) g.set(x, y, id);
    if (!spec) spare += ss.length;
  };
  const sameRun = (a: Strip, c: Strip | undefined): boolean => !!c && c.full && c.face === a.face && Math.sign(c.off) === Math.sign(a.off);
  let turn = 0;
  for (let i = 0; i < order.length;) {
    const s = order[i] as Strip, next = order[i + 1];
    // The two strips either side of an east, south or west axis are one double room.
    if (s.face !== 'n' && Math.abs(s.off) === K / 2 && next && next.face === s.face && next.full && Math.abs(next.off) === K / 2) {
      const k = others.findIndex((r) => stripsFor(r) <= 2);
      give(k >= 0 ? (others.splice(k, 1)[0] as RoomSpec) : (cabins.shift() ?? null), [s, next]);
      i += 2;
      continue;
    }
    let n = 1;
    while (sameRun(s, order[i + n])) n++;
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
  const b = localBuilder(rng);
  const unplaced = cabins.length + others.length;
  if (unplaced > 0) return { b, left: unplaced, spare, why: `band short of ${cabins.length} cabins, ${others.map((r) => `${r.role} ${r.w}x${r.h}`).join(', ')}` };
  // Every room must be walkable to: one stranded tile and the fit-out places nothing solid anywhere.
  const cut = g.stranded();
  if (cut.length > 0) return { b, left: cut.length, spare, why: `no way in to ${cut.map(([x, y, id]) => `${g.regions[id]?.role} at ${x},${y}`).join('; ')}` };
  g.stamp(b);
  return { b, left: 0, spare, why: '' };
}

/** The flow wheel for these rooms (the office among them, docks too); `market` gives it shops. `trace` collects why each smaller radius failed. */
export function flowWheel(rng: Rng, rooms: RoomSpec[], market: boolean, trace?: string[]): FlowWheel | null {
  const shops = market ? Math.max(4, Math.min(12, Math.round(rooms.length / 3))) : 0;
  for (let cells = 8; cells <= 14; cells++) {
    const r = build(rng, rooms, cells * K, shops);
    if (r.left === 0) return { b: r.b, label: `stationFlow harbour-market R ${cells * K} shops ${shops} spare strips ${r.spare}` };
    trace?.push(`R ${cells * K}: ${r.why}`);
  }
  return null;
}
