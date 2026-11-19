import type { ModuleDef } from '../../registry';
import { cargoSpec, dockSpec, engineSpec, reactorSpec, weaponSpec, type RoomSpec, type ShipPlan } from '../plan';
import { pairUp } from '../topoNavy';
import { NAVY_TYPES, type NavyType } from './navyShip';
import { RegionGrid, SOLID, SPACE } from './regions';

/**
 * Rooms cut into a navy outline by corridors, blocks and one splitter (SHIPGEN_V4, "Room layout"): the spine and the
 * cross corridors cut the side into bands; rooms whose equipment needs a hull wall claim it (engines the aft wall, guns
 * the side hull of the outer tier, airlocks the flat ends of cross corridors, the bridge the bow); one splitter cuts
 * every band into rooms by planned area. Laid out on the north side (y < 0) and mirrored, a room pair per slot.
 */

/** Side rows out from the axis: the spine is rows -1..1, its wall row 2, room floor from row 3 (room row 1). */
const BAND = 2;
/** Floor rows a room has at least, and so a tier. */
const MIN_DEPTH = 3;
/** Columns a cabin takes at least, its wall included; floor a cabin takes. */
const CABIN = 4, CABIN_AREA = 14;
/** A room at most this many times as deep as it is long. */
const ASPECT = 3;
/** Rooms bow to stern within a band: guns forward, then defences, works and stores, the crew aft. */
const ZONE = ['weapons', 'bridge', 'shields', 'core', 'reactor', 'plant', 'cargo', 'hangar', 'support', 'quarters'];
/** A mess: a galley and tables down a long narrow room, the crew's commons. */
const MESS: RoomSpec = { role: 'support', dept: 'commons', mods: ['module.galley', 'module.mess_table'], w: 6, h: 3 };

export interface Mask { W: number; H: number; inside: (x: number, y: number) => boolean }
type Pair = readonly [RoomSpec, RoomSpec];
/** A band: runs of columns (end exclusive) and each column's floor rows (room rows, from 1 at the spine's wall). */
interface Band { segs: [number, number][]; lo: (x: number) => number; hi: (x: number) => number }
interface Piece { pair: Pair; x0: number; x1: number }

/**
 * Rooms paired across the axis: the same role where there are two, then unlike rooms of a size together (the shape
 * mirrors, the use need not), and the one left over gets a mess opposite it (a store when there is one).
 */
function mirrorPairs(specs: RoomSpec[]): Pair[] {
  const rest = [...specs], out: Pair[] = [];
  const push = (a: RoomSpec, b: RoomSpec): void => { const w = Math.max(a.w, b.w), h = Math.max(a.h, b.h); out.push([{ ...a, w, h }, { ...b, w, h }]); };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i] as RoomSpec, j = rest.findIndex((r, k) => k > i && r.role === a.role);
    if (j > 0) { push(a, rest[j] as RoomSpec); rest.splice(j, 1); rest.splice(i, 1); i--; }
  }
  rest.sort((a, b) => b.w * b.h - a.w * a.h);
  while (rest.length > 1) push(rest.shift() as RoomSpec, rest.shift() as RoomSpec);
  if (rest.length === 1) push(rest[0] as RoomSpec, specs.includes(MESS) ? cargoSpec(2) : MESS);
  return out;
}

/** A room's least length along the band: a reactor lies along a wall its full length, others at least their short side. */
const minLen = (r: RoomSpec): number => (r.role === 'reactor' ? r.w : Math.min(r.w, r.h));
const areaOf = ([r]: Pair): number => r.w * r.h;
/** A store pair for a stretch of band `len` long: floor no room was planned for. */
const store = (len: number): Pair => [cargoSpec(Math.max(1, Math.floor(len / 2))), cargoSpec(Math.max(1, Math.floor(len / 2)))];

/**
 * The splitter: pairs in order along a band's runs, each taking columns until its share of the band is met (the band's
 * floor shared out in proportion to the planned areas), a plating column between rooms; a room too long for what is
 * left of a run moves to the next, the room before it taking the rest. Null when the pairs do not fit; with `sparse`,
 * runs may stay empty (an outer tier: the inner rooms keep the full depth there).
 */
function split(band: Band, pairs: readonly Pair[], vary: readonly number[], sparse: boolean): Piece[] | null {
  const area = (x: number): number => Math.max(0, band.hi(x) - band.lo(x) + 1);
  let avail = 0;
  for (const [a, b] of band.segs) for (let x = a; x < b; x++) avail += area(x);
  const want = pairs.reduce((t, p) => t + areaOf(p), 0);
  const full = Math.max(1, avail / Math.max(1, want) - 0.15);
  const tryShare = (share: number): Piece[] | null => {
    const out: Piece[] = [];
    let s = 0, x = band.segs[0]?.[0] ?? 0, first = out.length;
    // A run's end: what is left from `x` on, long enough for a room, is a store (an outer tier leaves it to the inner
    // rooms); else the run's last room takes it. Then the next run.
    const next = (): void => {
      const last = out.length > first ? out[out.length - 1] : undefined, end = (band.segs[s] as [number, number])[1];
      if (end - x >= MIN_DEPTH) { if (!sparse) out.push({ pair: store(end - x), x0: x, x1: end }); } else if (last) last.x1 = end;
      s++; x = band.segs[s]?.[0] ?? 0; first = out.length;
    };
    for (const [i, pair] of pairs.entries()) {
      const r = pair[0], len = minLen(r), goal = areaOf(pair) * share * (vary[i % vary.length] ?? 1);
      // A room takes columns until its share is met, but no longer than three times its depth once it has its planned
      // floor; one that a run cannot hold moves on to the next run.
      for (;;) {
        if (s >= band.segs.length) return null;
        const end = (band.segs[s] as [number, number])[1], x0 = x;
        let a = 0, deep = 0;
        const long = (): boolean => a >= r.w * r.h && (x - x0) >= ASPECT * (a / Math.max(1, x - x0));
        for (; x < end && ((a < goal && !long()) || x - x0 < len || (x - x0) * ASPECT < deep); x++) { a += area(x); deep = Math.max(deep, area(x)); }
        if (a >= r.w * r.h && x - x0 >= len) { out.push({ pair, x0, x1: x }); x++; break; }
        x = x0;
        next();
      }
    }
    if (s < band.segs.length && x < (band.segs[s] as [number, number])[1]) next(); else s++;
    // Runs of an inner band the rooms did not reach hold stores (no floor stands empty).
    if (!sparse) for (const [a, b] of band.segs.slice(s)) out.push({ pair: store(b - a), x0: a, x1: b });
    return out;
  };
  return tryShare(full) ?? tryShare((1 + full) / 2) ?? tryShare(1);
}

/** Rooms cut into the outline, or null when they do not fit at this scale. */
export function layoutBlocks(plan: ShipPlan, m: Mask, type: NavyType, vary: readonly number[], defs: Record<string, ModuleDef>): { g: RegionGrid } | null {
  const { W, H, inside } = m;
  if (2 * H + 4 > 120 || W + 4 > 240) return null;
  const top = (x: number): number => { let y = 0; while (inside(x, y + 1)) y++; return inside(x, 0) ? y : -1; };
  const depth = (x: number): number => top(x) - BAND - 1;
  const rowEnd = (y: number): number => { let x = W - 1; while (x > 0 && !inside(x, y)) x--; return x; };
  let xEnd = W - 1;
  while (xEnd > 0 && !inside(xEnd, 0)) xEnd--;

  // Engines claim the aft hull: out from the spine, each run of rows sharing an aft wall (a row beside one reaching
  // further aft has wall, not space, behind its hull tile) takes the engines it is deep enough for, a walk column ahead.
  const one = engineSpec(1, 'w', plan.kit);
  const xS = Math.min(xEnd, rowEnd(-(BAND + 1))) - one.w - 1;
  let sternMax = 0;
  for (let tx = xS + 1; tx <= xEnd; tx++) sternMax = Math.max(sternMax, depth(tx));
  const need = Math.ceil(plan.engines / 2), most = Math.max(need, 3);
  let perSide = 0, used = 0;
  for (let r = 0; r < sternMax && perSide < most;) {
    let run = 1;
    while (r + run < sternMax && rowEnd(-(BAND + 1 + r + run)) === rowEnd(-(BAND + 1 + r))) run++;
    const end = rowEnd(-(BAND + 1 + r)), longer = (y: number): number => (rowEnd(y) > end ? 1 : 0);
    const k = Math.min(Math.floor((run - (r > 0 ? longer(-(BAND + r)) : 0) - longer(-(BAND + 1 + r + run))) / one.h), most - perSide);
    if (k > 0) { perSide += k; used = r + run; }
    r += run;
  }
  if (perSide < need || perSide === 0) return null;
  const engine = engineSpec(perSide, 'w', plan.kit);

  // The bridge takes the bow, sized to its plan and at least four columns.
  const bridge = plan.command;
  let xBr = 0, area = 0;
  while (xBr < xS && (area < 1.3 * bridge.w * bridge.h || top(xBr) < 2 || xBr <= MIN_DEPTH + 1)) { area += Math.max(0, 2 * top(xBr) - 1); xBr++; }
  let xBand = xBr + 1;
  while (xBand < xS && depth(xBand) < 1) xBand++;
  if (xBand >= xS - 6) return null;

  // The inner tier: as deep as the shallower part of the side (its lower quartile), at most a room and a half; a column
  // deep enough for a second tier beyond it splits.
  const sorted = Array.from({ length: xS - xBand }, (_, k) => depth(xBand + k)).sort((p, q) => p - q);
  const low = sorted[Math.floor(sorted.length / 4)] ?? 0;
  if (low < MIN_DEPTH) return null;
  const di = Math.min(low, MIN_DEPTH + 2);
  const tiered = (x: number): boolean => depth(x) >= di + 1 + MIN_DEPTH;

  // The cross corridor: out to the airlocks at the hull's widest flat stretch (an airlock needs a flat outer wall), in the
  // forward three quarters, leaving a room's length either side. Outer rooms elsewhere open into the room in front.
  const CW = dockSpec().w;
  const flat = (x0: number): boolean => { for (let k = -1; k <= CW; k++) if (top(x0 + k) !== top(x0)) return false; return true; };
  let dockAt = -1;
  for (let x = xBand + MIN_DEPTH + 1; x <= Math.min(xS - MIN_DEPTH - CW - 1, xBand + 0.75 * (xS - xBand)); x++) if (flat(x) && (dockAt < 0 || depth(x) > depth(dockAt))) dockAt = x;
  if (dockAt < 0) return null;
  const cross = [dockAt];

  // Runs of band columns between the bridge, the cross corridors and the drive (a plating column each side of a corridor).
  const runs = (from: number, to: number): [number, number][] => {
    const out: [number, number][] = [];
    let a = from;
    for (const c of cross) { if (c - 1 > a) out.push([a, c - 1]); a = c + CW + 1; }
    if (to > a) out.push([a, to]);
    return out;
  };

  // The rooms, paired to mirror: guns (a lone room of several guns splits, a gun each side), then the rest by zone.
  const guns = plan.weapons.flatMap((r) => (r.mods.length > 1 && plan.weapons.length % 2 === 1 && r === plan.weapons[plan.weapons.length - 1]
    ? [weaponSpec(defs, r.mods.slice(0, Math.ceil(r.mods.length / 2))), weaponSpec(defs, r.mods.slice(Math.ceil(r.mods.length / 2)))]
    : [r]));
  const lone = guns.length % 2 === 1 ? [guns.pop() as RoomSpec] : [];
  const reactors = Array.from({ length: plan.reactors }, () => reactorSpec(1, plan.kit));
  const rest = [...lone, ...(plan.crew.length >= 3 ? [MESS] : []), ...reactors, ...plan.shields, ...(plan.core ? [plan.core] : []), ...plan.quarters, ...plan.support, ...plan.cargo, ...plan.hangars];
  const [gn, gs] = pairUp(guns);
  const gunPairs: Pair[] = gn.map((r, i) => [r, gs[i] as RoomSpec] as const);
  const zone = (p: Pair): number => ZONE.indexOf(p[0].role);
  const others = mirrorPairs(rest).sort((a, b) => zone(a) - zone(b));

  // The stern past the engines' rows, deep enough for a room, is an outer tier off the engine room.
  const sternOuter = sternMax - used - 1 >= MIN_DEPTH;
  const outer: Band = {
    segs: [...runs(xBand, xS).flatMap(([a, b]) => { const out: [number, number][] = []; for (let x = a; x < b;) { if (!tiered(x)) { x++; continue; } let e = x; while (e < b && tiered(e)) e++; if (e - x >= MIN_DEPTH) out.push([x, e]); x = e; } return out; }), ...(sternOuter ? [[xS + 1, W] as [number, number]] : [])],
    lo: (x) => (x > xS ? used + 2 : di + 2), hi: (x) => depth(x),
  };
  // Outer slots go to the guns where a type spreads them (the side hull, the wings first; a forward battery stays in the
  // bow's rooms, which reach the hull), then the smallest rooms, as far as the outer floor goes.
  const outerGuns = NAVY_TYPES[type].guns === 'spread' ? gunPairs : [];
  let outerArea = 0;
  for (const [a, b] of outer.segs) for (let x = a; x < b; x++) outerArea += Math.max(0, outer.hi(x) - outer.lo(x) + 1);
  const byArea = [...others].sort((a, b) => areaOf(a) - areaOf(b));
  let outerPairs: Pair[] = [];
  for (const p of [...outerGuns, ...byArea]) if (outerPairs.reduce((t, q) => t + areaOf(q), 0) + areaOf(p) <= outerArea * 0.9) outerPairs.push(p);
  let outerCut: Piece[] | null = null;
  while (outerPairs.length > 0 && !(outerCut = split(outer, [...outerPairs].sort((a, b) => zone(a) - zone(b)), vary, true))) outerPairs = outerPairs.slice(0, -1);
  // Two-tier columns: under an outer room, and the plating column between two of them.
  const outerOf = (x: number): boolean => !!outerCut?.some((p) => x >= p.x0 && (x < p.x1 || (x === p.x1 && !!outerCut?.some((q) => q.x0 === x + 1))));
  const innerPairs = [...gunPairs, ...others].filter((p) => !outerPairs.includes(p));
  const inner: Band = { segs: runs(xBand, xS), lo: () => 1, hi: (x) => (outerOf(x) ? di : depth(x)) };
  if (NAVY_TYPES[type].guns === 'spread') {
    // Spread guns: the first pair forward, the rest one between every few rooms.
    const g = innerPairs.filter((p) => gunPairs.includes(p)), o = innerPairs.filter((p) => !gunPairs.includes(p));
    const every = Math.max(1, Math.floor(o.length / Math.max(1, g.length - 1)));
    innerPairs.splice(0, innerPairs.length, ...g.flatMap((p, i) => [p, ...o.slice(i * every, (i + 1) * every)]), ...o.slice(g.length * every));
  }
  const innerCut = split(inner, innerPairs, vary, false);
  if (!innerCut) return null;

  // Paint: the bridge, the band rooms (barracks long enough become cabins), the outer tier, the drive, the corridors.
  const g = new RegionGrid(128);
  const ox = -Math.floor(W / 2);
  const paint = (id: number, x0: number, x1: number, yIn: (y: number) => boolean): void => {
    for (let tx = x0; tx < x1; tx++) for (let ty = -H; ty <= H; ty++) if (inside(tx, ty) && yIn(ty)) g.set(ox + tx, ty, id);
  };
  const hall = g.hall('hall');
  // The airlock bays: the cross corridor's halls, with their fixture.
  const docks: [number, number] = [g.hall('dock', undefined, dockSpec()), g.hall('dock', undefined, dockSpec())];
  paint(g.room(bridge.role, { spec: bridge }), 0, xBr, () => true);
  const innerIds = new Map<number, [number, number]>();
  for (const { pair: [r, sr], x0, x1 } of innerCut) {
    let a = 0;
    for (let tx = x0; tx < x1; tx++) a += Math.max(0, inner.hi(tx));
    const k = r.role === 'quarters' ? Math.max(1, Math.min(r.mods.length, Math.floor(a / CABIN_AREA), Math.floor((x1 - x0 + 1) / CABIN))) : 1;
    for (let c = 0; c < k; c++) {
      const c0 = x0 + Math.round(((x1 - x0 + 1) * c) / k), c1 = x0 + Math.round(((x1 - x0 + 1) * (c + 1)) / k) - 1;
      const part = (spec: RoomSpec): RoomSpec => (k === 1 ? spec : { ...spec, mods: spec.mods.filter((_, j) => j % k === c), w: c1 - c0 });
      const n = g.room(r.role, { spec: part(r) }), s = g.room(sr.role, { spec: part(sr) });
      for (let tx = c0; tx < c1; tx++) innerIds.set(tx, [n, s]);
      for (let tx = c0; tx < c1; tx++) {
        const deep = BAND + inner.hi(tx);
        paint(n, tx, tx + 1, (y) => y <= -BAND && y >= -(outerOf(tx) ? deep : Infinity));
        paint(s, tx, tx + 1, (y) => y >= BAND && y <= (outerOf(tx) ? deep : Infinity));
      }
    }
  }
  const engines: [number, number] = [g.room('engine', { spec: engine, doorFirst: true }), g.room('engine', { spec: engine, doorFirst: true })];
  paint(engines[0], xS + 1, W, (y) => y <= -BAND && (!sternOuter || -y <= BAND + used));
  paint(engines[1], xS + 1, W, (y) => y >= BAND && (!sternOuter || y <= BAND + used));
  // An outer room opens onto a cross corridor it touches, else into the room in front of it.
  for (const { pair: [r, sr], x0, x1 } of outerCut ?? []) {
    const front = x0 > xS ? engines : (innerIds.get(Math.floor((x0 + x1) / 2)) ?? engines);
    const lo = (x: number): number => BAND + outer.lo(x);
    paint(g.room(r.role, { spec: r, access: [hall, docks[0], front[0]], doorFirst: x0 > xS }), x0, x1, (y) => y <= -lo(x0));
    paint(g.room(sr.role, { spec: sr, access: [hall, docks[1], front[1]], doorFirst: x0 > xS }), x0, x1, (y) => y >= lo(x0));
  }
  for (let tx = 0; tx < W; tx++) for (let ty = -H; ty <= H; ty++) if (inside(tx, ty) && g.at(ox + tx, ty) === SPACE) g.set(ox + tx, ty, SOLID);
  for (let tx = xBr; tx < W; tx++) for (let ty = -1; ty <= 1; ty++) if (inside(tx, ty)) g.set(ox + tx, ty, hall);
  // The cross corridor out to the airlocks.
  paint(docks[0], dockAt, dockAt + CW, (y) => y <= -BAND);
  paint(docks[1], dockAt, dockAt + CW, (y) => y >= BAND);
  return { g };
}
