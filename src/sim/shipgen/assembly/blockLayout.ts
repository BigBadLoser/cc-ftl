import type { ModuleDef } from '../../registry';
import { cargoSpec, dockSpec, engineSpec, reactorSpec, weaponSpec, type RoomSpec, type ShipPlan } from '../plan';
import { pairUp } from '../topoNavy';
import { MESS, NAVY_TYPES, type NavyType } from './navyShip';
import { RegionGrid, SOLID, SPACE } from './regions';
import { CABIN_TIER, cabinsFor } from './cabinBlock';
import { FILL_MAX, fillerFor, fillerSpec, maxArea, type Filler } from './roomSize';
import { onHall, opensThrough, roomKind, type RoomKind } from './roomAccess';

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
/** A room at most this many times as long as it is deep, and at most `DEEP` times as deep as it is long (no thin strips). */
const ASPECT = 3, DEEP = 2;
/** Rooms bow to stern within a band: guns forward, then defences, works and stores, the crew aft. */
const ZONE = ['weapons', 'bridge', 'shields', 'core', 'reactor', 'plant', 'farm', 'cargo', 'hangar', 'armoury', 'support', 'medbay', 'quarters'];

export interface Mask { W: number; H: number; inside: (x: number, y: number) => boolean }
type Pair = readonly [RoomSpec, RoomSpec];
/** A band: runs of columns (end exclusive) and each column's floor rows (room rows, from 1 at the spine's wall). */
interface Band { segs: [number, number][]; lo: (x: number) => number; hi: (x: number) => number }
interface Piece { pair: Pair; x0: number; x1: number; /** An outer room's column in front of its own room (it keeps that door when it widens). */ at?: number }

/**
 * Rooms paired across the axis: the same role where there are two, then unlike rooms of a size together (the shape
 * mirrors, the use need not), and the one left over gets a mess opposite it (a store when there is one). An annex counts
 * in its host's size.
 */
function mirrorPairs(specs: RoomSpec[]): Pair[] {
  const rest = [...specs], out: Pair[] = [];
  const push = (a: RoomSpec, b: RoomSpec): void => { const w = Math.max(a.w, b.w), h = Math.max(a.h, b.h); out.push([{ ...a, w, h }, { ...b, w, h }]); };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i] as RoomSpec, j = rest.findIndex((r, k) => k > i && r.role === a.role && (!a.block || r.mods.length === a.mods.length));
    if (j > 0) { push(a, rest[j] as RoomSpec); rest.splice(j, 1); rest.splice(i, 1); i--; }
  }
  rest.sort((a, b) => full(b) - full(a));
  // Unlike rooms pair when near a size; a room much bigger than the next gets filler rooms opposite.
  while (rest.length > 1) {
    const a = rest.shift() as RoomSpec;
    push(a, full(rest[0] as RoomSpec) * 1.5 >= full(a) ? (rest.shift() as RoomSpec) : fillOpposite(a));
  }
  if (rest.length === 1) push(rest[0] as RoomSpec, specs.some((r) => r.role === 'support' && r.mods.includes('module.galley')) ? cargoSpec(2) : MESS);
  return out;
}

/** The floor opposite a room with no partner its size: as big, cut into fillers when painted. */
const fillOpposite = (a: RoomSpec): RoomSpec => ({ role: 'cargo', mods: [], w: a.w, h: a.h, fill: true });
/** A room's floor with its annex. */
const full = (r: RoomSpec): number => r.w * r.h + (r.annex ? r.annex.w * r.annex.h : 0);
/**
 * A room's least length along the band: a reactor lies along a wall its full length, a room with an annex room for both
 * side by side (where it is too shallow for the annex behind), others at least their short side.
 */
const minLen = (r: RoomSpec): number => (r.annex ? 2 * MIN_DEPTH + 1 : r.role === 'reactor' ? r.w : Math.min(r.w, r.h));
const areaOf = ([r, s]: Pair): number => Math.max(full(r), full(s));
/** A store pair for a stretch of band `len` long: floor no room was planned for. */
/** The most floor a pair takes: the smaller of its rooms' caps, its planned floor at least. */
const capOf = ([r, s]: Pair): number => Math.max(areaOf([r, s]), Math.min(maxArea(r), maxArea(s)));
/** Which fillers a ship has used (one workshop, lounge and gym a side at most; a farm where the ship carries one). */
export interface Fills { left: Filler[] }
// One of a kind a ship (the room opposite a hold of the same shape), holds in pairs.
const fillPair = (fills: Fills, area: number, deep: number): Pair => {
  const r = fillerFor(fills.left, area, deep, deep >= 2 * MIN_DEPTH + 1);
  return roomKind(r) === 'cargo' ? [r, r] : [r, fillerFor([], area, deep, deep >= 2 * MIN_DEPTH + 1)];
};

/**
 * The splitter: pairs in order along a band's runs, each taking columns until its share of the band is met (the band's
 * floor shared out in proportion to the planned areas), a plating column between rooms; a room too long for what is
 * left of a run moves to the next, the room before it taking the rest. Null when the pairs do not fit; with `sparse`,
 * runs may stay empty (an outer tier: the inner rooms keep the full depth there).
 */
function split(band: Band, pairs: readonly Pair[], vary: readonly number[], sparse: boolean, fills: Fills): Piece[] | null {
  const area = (x: number): number => Math.max(0, band.hi(x) - band.lo(x) + 1);
  {
    const out: Piece[] = [];
    let s = 0, x = band.segs[0]?.[0] ?? 0, first = out.length;
    // Leftover floor from a to b as filler rooms, each within the fillers' size and none much longer than it is deep
    // (a plating column between them).
    const stores = (a: number, b: number): void => {
      let floor = 0;
      for (let x = a; x < b; x++) floor += area(x);
      const deep = Math.max(MIN_DEPTH, area(a));
      // As many as keep each within the fillers' size, none narrower than its depth allows.
      const most = Math.max(1, Math.floor((b - a + 1) / (Math.max(MIN_DEPTH, Math.ceil(deep / DEEP)) + 1)));
      const n = Math.min(most, Math.max(1, Math.round((b - a + 1) / (1.5 * deep + 1)), Math.ceil(floor / FILL_MAX)));
      for (let k = 0, x0 = a; k < n; k++) {
        const x1 = k === n - 1 ? b : a + Math.round(((k + 1) * (b - a + 1)) / n) - 1;
        let f = 0;
        for (let x = x0; x < x1; x++) f += area(x);
        out.push({ pair: fillPair(fills, f, deep), x0, x1 });
        x0 = x1 + 1;
      }
    };
    // A run's end: what is left from `x` on, long enough for a room, is a store (an outer tier leaves it to the inner
    // rooms); else the run's last room takes it. Then the next run.
    const next = (): void => {
      const last = out.length > first ? out[out.length - 1] : undefined, end = (band.segs[s] as [number, number])[1];
      if (end - x >= MIN_DEPTH) { if (!sparse) stores(x, end); } else if (last) last.x1 = end;
      s++; x = band.segs[s]?.[0] ?? 0; first = out.length;
    };
    for (const [i, pair] of pairs.entries()) {
      const len = Math.max(minLen(pair[0]), minLen(pair[1])), cap = capOf(pair), goal = Math.min(cap, areaOf(pair) * Math.max(1, vary[i % vary.length] ?? 1));
      // A room takes columns until its share is met, but no longer than three times its depth once it has its planned
      // floor; one that a run cannot hold moves on to the next run.
      for (;;) {
        if (s >= band.segs.length) return null;
        const end = (band.segs[s] as [number, number])[1], x0 = x;
        let a = 0, deep = 0;
        // Past its planned floor, a room stops at three times its depth or at its cap.
        const plan = areaOf(pair);
        const long = (): boolean => a >= plan && ((x - x0) >= ASPECT * (a / Math.max(1, x - x0)) || a + area(x) > cap);
        for (; x < end && ((a < goal && !long()) || x - x0 < len || (x - x0) * DEEP < deep); x++) { a += area(x); deep = Math.max(deep, area(x)); }
        // A cabin block: as long as its cabins ask at the depth it gets (two rows of cabins off a corridor of its own
        // where the floor is deep enough, else a row of cabins three wide on the spine), so they cut evenly.
        const blk = pair[0].block ? pair[0] : pair[1].block ? pair[1] : null;
        if (blk) {
          x = x0;
          const want = area(x0) >= 2 * CABIN_TIER - 1 ? blk.w : 4 * blk.mods.length - 1;
          if (x0 + want <= end) { out.push({ pair, x0, x1: x0 + want }); x = x0 + want + 1; break; }
          next();
          continue;
        }
        if (a >= plan && x - x0 >= len) { out.push({ pair, x0, x1: x }); x++; break; }
        x = x0;
        next();
      }
    }
    if (s < band.segs.length && x < (band.segs[s] as [number, number])[1]) next(); else s++;
    // Runs of an inner band the rooms did not reach hold stores (no floor stands empty).
    if (!sparse) for (const [a, b] of band.segs.slice(s)) stores(a, b);
    return out;
  }
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
  // A second, plain cross corridor only where the hull aft is deep enough for a back room as deep as the front one
  // (rooms there would else open through others), along a stretch with a room's length either side of it.
  let aft = -1;
  for (let x = dockAt + CW + 1, run = 0, best = 0; x < xS; x++) {
    run = depth(x) >= 2 * di + 2 ? run + 1 : 0;
    if (run > best && run >= 2 * (MIN_DEPTH + 2) + CW) { best = run; aft = x - Math.floor((run + CW) / 2); }
  }
  const cross = aft > 0 ? [dockAt, aft] : [dockAt];
  /** The corridor a slot opens onto at its end (the airlock bay or the plain cross corridor), if any. */
  const crossAt = (slot: { x0: number; x1: number }): number => cross.find((c) => slot.x1 === c - 1 || slot.x0 === c + CW + 1) ?? -1;

  // Runs of band columns between the bridge, the cross corridors, the cabin block and the drive (a plating column each
  // side of a corridor or the block).
  let claim: Piece | null = null;
  const runs = (from: number, to: number): [number, number][] => {
    const out: [number, number][] = [];
    let a = from;
    const stops = [...cross.map((c) => [c, c + CW] as const), ...(claim ? [[claim.x0, claim.x1] as const] : [])].sort((p, q) => p[0] - q[0]);
    for (const [c0, c1] of stops) { if (c0 - 1 > a) out.push([a, c0 - 1]); a = Math.max(a, c1 + 1); }
    if (to > a) out.push([a, to]);
    return out;
  };
  const paintFill = (v: Fill, tx: number, d: (y: number) => number, upper: number): void => {
    paint(v.id, tx, tx + 1, (y) => d(y) >= BAND && d(y) <= Math.min(upper, v.annex === undefined ? Infinity : BAND + v.at - 2));
    if (v.annex !== undefined) paint(v.annex, tx, tx + 1, (y) => d(y) >= BAND + v.at && d(y) <= upper);
  };
  // The cabin blocks claim deep floor first, as guns the side hull: every bed a cabin, two cabins a row either side of
  // a corridor of their own, the beds made even and shared over both sides. One corridor's width where the floor is
  // deep enough, else two; the aftmost stretch deep enough, leaving no run too short for a room beside it.
  const blockBeds = plan.quarters.filter((q) => q.block).reduce((n, q) => n + q.mods.length, 0);
  if (blockBeds > 0) {
    // Each side's cabins even (two a row), the larger share north: 10 beds are 6 and 4.
    const north = 2 * Math.ceil(blockBeds / 4), south = blockBeds - north, per = north;
    for (const [units, len] of [[1, 11], [2, 23]] as const) {
      const rows = CABIN_TIER * Math.max(2, Math.ceil(per / (2 * units))) - 1;
      for (const [a, b] of runs(xBand, xS).reverse()) {
        for (let x0 = b - len; x0 >= a && !claim; x0--) {
          const gl = x0 - a, gr = b - x0 - len;
          if ((gl > 0 && gl < MIN_DEPTH + 2) || (gr > 0 && gr < MIN_DEPTH + 2)) continue;
          let ok = true;
          for (let x = x0; x < x0 + len; x++) if (depth(x) < rows) ok = false;
          const spec = (n: number): RoomSpec => ({ role: 'quarters', mods: Array<string>(n).fill('module.bed'), w: len, h: rows, block: true, cabins: false });
          if (ok) claim = { pair: [spec(north), spec(south)], x0, x1: x0 + len };
        }
        if (claim) break;
      }
      if (claim) break;
    }
  }

  // The rooms, paired to mirror: guns (a lone room of several guns splits, a gun each side), then the rest by zone.
  const guns = plan.weapons.flatMap((r) => (r.mods.length > 1 && plan.weapons.length % 2 === 1 && r === plan.weapons[plan.weapons.length - 1]
    ? [weaponSpec(defs, r.mods.slice(0, Math.ceil(r.mods.length / 2))), weaponSpec(defs, r.mods.slice(Math.ceil(r.mods.length / 2)))]
    : [r]));
  const lone = guns.length % 2 === 1 ? [guns.pop() as RoomSpec] : [];
  // Reactors two a room past a pair (a room each for one or two), so no reactor room stands mostly bare.
  const reactors = plan.reactors <= 2 ? Array.from({ length: plan.reactors }, () => reactorSpec(1, plan.kit))
    : Array.from({ length: Math.ceil(plan.reactors / 2) }, (_, i) => reactorSpec(Math.min(2, plan.reactors - 2 * i), plan.kit));
  const rest = [...lone, ...reactors, ...plan.shields, ...(plan.core ? [plan.core] : []), ...plan.quarters.filter((q) => !claim || !q.block), ...plan.support, ...plan.cargo, ...plan.hangars];
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
  const byKind = (p: Pair, f: (k: RoomKind) => boolean): boolean => f(roomKind(p[0])) || f(roomKind(p[1]));
  // A room that may stand behind another at all (not a corridor-only one).
  const canBack = (k: RoomKind): boolean => (['guns', 'engine', 'reactor', 'shields', 'core', 'plant', 'cargo', 'barracks', 'pantry', 'trauma', 'hangar', 'farm', 'other'] as RoomKind[]).some((f) => opensThrough(k, f));
  const frontOf = (slot: Piece): Pair | null => (slot.x0 > xS ? [engine, engine] : innerCut?.find((q) => q.x0 <= (slot.x0 + slot.x1) >> 1 && (slot.x0 + slot.x1) >> 1 < q.x1)?.pair ?? null);
  const annexBehind = (x0: number, x1: number): boolean => !!innerCut?.some((q) => q.x0 < x1 && x0 < q.x1 && (!!q.pair[0].annex || !!q.pair[1].annex));
  const entersFrom = (p: Pair, slot: Piece): boolean => {
    // A room with an annex keeps the floor behind it for the annex.
    if (annexBehind(slot.x0, slot.x1)) return false;
    if (crossAt(slot) >= 0) return onHall(roomKind(p[0])) && onHall(roomKind(p[1]));
    const f = frontOf(slot);
    return !!f && opensThrough(roomKind(p[0]), roomKind(f[0])) && opensThrough(roomKind(p[1]), roomKind(f[1]));
  };
  let outerPairs: Pair[] = [];
  for (const p of [...outerGuns, ...byArea]) if (!byKind(p, (k) => !onHall(k) || !canBack(k)) && !p[0].block && !p[1].block && outerPairs.reduce((t, q) => t + areaOf(q), 0) + areaOf(p) <= outerArea * 0.9) outerPairs.push(p);
  let outerCut: Piece[] = [], innerCut: Piece[] | null = null, fillsLeft: Filler[] = [];
  const inner: Band = { segs: runs(xBand, xS), lo: () => 1, hi: (x) => (outerOf(x) ? di : depth(x)) };
  // Two-tier columns: under an outer room, and the plating column between two of them.
  function outerOf(x: number): boolean { return outerCut.some((p) => x >= p.x0 && (x < p.x1 || (x === p.x1 && outerCut.some((q) => q.x0 === x + 1)))); }
  // An outer room opens onto the cross corridor it touches, else only into a room in front it may open off: the outer
  // rooms go to the slots whose front rooms let them in; one with no such slot moves to the inner band.
  for (let round = 0; round < 6; round++) {
    let cut: Piece[] | null = null;
    while (outerPairs.length > 0 && !(cut = split(outer, [...outerPairs].sort((a, b) => zone(a) - zone(b)), vary, true, { left: [] }))) outerPairs = outerPairs.slice(0, -1);
    outerCut = cut ?? [];
    const innerPairs = [...gunPairs, ...others].filter((p) => !outerPairs.includes(p));
    if (NAVY_TYPES[type].guns === 'spread') {
      // Spread guns: the first pair forward, the rest one between every few rooms.
      const gp = innerPairs.filter((p) => gunPairs.includes(p)), o = innerPairs.filter((p) => !gunPairs.includes(p));
      const every = Math.max(1, Math.floor(o.length / Math.max(1, gp.length - 1)));
      innerPairs.splice(0, innerPairs.length, ...gp.flatMap((p, i) => [p, ...o.slice(i * every, (i + 1) * every)]), ...o.slice(gp.length * every));
    }
    // Fillers past the default holds: one of each a side, a farm only where the type carries one.
    const has = (k: RoomKind): boolean => [...innerPairs, ...outerPairs].some((p) => roomKind(p[0]) === k || roomKind(p[1]) === k);
    const fills: Fills = { left: [...(has('workshop') ? [] : ['workshop' as const]), 'lounge', 'gym', ...((NAVY_TYPES[type].rooms ?? []).includes('farm') ? ['farm' as const] : [])] };
    innerCut = split(inner, innerPairs, vary, false, fills);
    if (innerCut && claim) innerCut = [...innerCut, claim].sort((p, q) => p.x0 - q.x0);
    fillsLeft = fills.left;
    if (!innerCut) return null;
    const slots = [...outerCut], left = [...outerPairs], placed: Piece[] = [];
    for (const slot of slots) {
      const room = (slot.x1 - slot.x0) * Math.max(1, outer.hi(slot.x0) - outer.lo(slot.x0) + 1);
      const fits = left.filter((p) => entersFrom(p, slot)).sort((a, b) => Math.abs(areaOf(a) - room) - Math.abs(areaOf(b) - room));
      const p = fits[0];
      if (p) { placed.push({ ...slot, pair: p, at: (slot.x0 + slot.x1) >> 1 }); left.splice(left.indexOf(p), 1); }
    }
    // A slot no room may stand in goes to the outer room beside it (across the plating column), not the room in front.
    for (let grew = true; grew;) {
      grew = false;
      for (const slot of slots) {
        if (placed.some((q) => q.x0 <= slot.x0 && slot.x1 <= q.x1) || annexBehind(slot.x0, slot.x1)) continue;
        const span = (o: Piece): number => (Math.max(o.x1, slot.x1) - Math.min(o.x0, slot.x0)) * Math.max(1, outer.hi(o.x0) - outer.lo(o.x0) + 1);
        const q = placed.find((o) => (o.x1 + 1 === slot.x0 || slot.x1 + 1 === o.x0) && (o.x0 > xS) === (slot.x0 > xS) && span(o) <= capOf(o.pair));
        if (q) { q.x0 = Math.min(q.x0, slot.x0); q.x1 = Math.max(q.x1, slot.x1); grew = true; }
      }
    }
    // A front room partly behind an outer room would wrap round it (an L): the outer room beside an uncovered two-tier
    // stretch of it takes that stretch, so front and back rooms share their edges. A front room with nothing behind it
    // keeps its full depth.
    const before = placed.map((q) => [q.x0, q.x1] as const);
    const covered = (c: number): boolean => before.some(([a0, a1]) => c >= a0 && c < a1);
    for (const f of innerCut) {
      let part = false;
      for (let c = f.x0; c < f.x1 && !f.pair[0].annex && !f.pair[1].annex; c++) if (covered(c)) part = true;
      for (let x = f.x0; part && x < f.x1;) {
        if (covered(x) || !tiered(x)) { x++; continue; }
        let e = x;
        while (e < f.x1 && !covered(e) && tiered(e)) e++;
        const q = placed.find((o) => (o.x0 > xS) === (x > xS) && (o.x1 === x || o.x1 + 1 === x || o.x0 === e || o.x0 - 1 === e));
        if (q) { q.x0 = Math.min(q.x0, x); q.x1 = Math.max(q.x1, e); }
        x = e;
      }
    }
    outerCut = placed;
    if (left.length === 0) break;
    outerPairs = outerPairs.filter((p) => !left.includes(p));
  }
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
  // From the first column three floor rows deep: a nose spike or tip narrower than the helm is plating.
  let xNose = 0;
  while (xNose < xBr - MIN_DEPTH && top(xNose) < 2) xNose++;
  paint(g.room(bridge.role, { spec: bridge }), xNose, xBr, () => true);
  const innerIds = new Map<number, [number, number]>();
  // Columns of the corridor stubs cut so far (blockLayout's deep rooms off the cross corridors).
  const stubCols: number[] = [];
  // The floor opposite a room with no partner its size, columns x0 to x1: filler rooms within the fillers' size, a
  // plating column between them (column to room).
  // A filler deep enough for two rooms past the fillers' size: a hold or workshop on the corridor rows and a hold behind
  // it from row `at` (opening through it).
  type Fill = { id: number; annex?: number; at: number };
  const fillCols = (x0: number, x1: number, rows: (tx: number) => number): Map<number, Fill> => {
    const out = new Map<number, Fill>(), L1 = x1 - x0 + 1, deep = Math.max(MIN_DEPTH, rows(x0));
    let f = 0;
    for (let tx = x0; tx < x1; tx++) f += rows(tx);
    const most = Math.max(1, Math.floor(L1 / (Math.max(MIN_DEPTH, Math.ceil(deep / DEEP)) + 1)));
    const n = Math.min(most, Math.max(1, Math.ceil(f / FILL_MAX)));
    for (let c = 0; c < n; c++) {
      const c0 = x0 + Math.round((L1 * c) / n), c1 = x0 + Math.round((L1 * (c + 1)) / n) - 1;
      let a = 0, low = Infinity;
      for (let tx = c0; tx < c1; tx++) { a += rows(tx); low = Math.min(low, rows(tx)); }
      const spec = fillerFor(fillsLeft, a, low, low >= 2 * MIN_DEPTH + 1), id = g.room(spec.role, { spec });
      const at = Math.max(MIN_DEPTH, Math.min(low - MIN_DEPTH, Math.round(low / 2))) + 1;
      const annex = spec.annex ? g.room(spec.annex.role, { spec: spec.annex, access: [id] }) : undefined;
      for (let tx = c0; tx < c1; tx++) out.set(tx, { id, at, ...(annex !== undefined ? { annex } : {}) });
    }
    return out;
  };
  for (const { pair: [r, sr], x0, x1 } of innerCut) {
    // Columns of the piece capped at the inner tier: under an outer room, and a sliver between outer rooms too narrow
    // for a room (it would make a strip), left plating behind.
    const capped = new Set<number>();
    for (let tx = x0; tx < x1;) {
      let e = tx;
      while (e < x1 && outerOf(e) === outerOf(tx)) e++;
      if (outerOf(tx) || (e - tx < MIN_DEPTH && (tx > x0 || e < x1) && [tx - 1, e].some((q) => outerOf(q)))) for (let q = tx; q < e; q++) capped.add(q);
      tx = e;
    }
    // A barracks deep enough for two rows of cabins: a cabin block off a corridor of its own.
    let rowsMin = Infinity;
    for (let tx = x0; tx < x1; tx++) rowsMin = capped.has(tx) ? -1 : Math.min(rowsMin, inner.hi(tx));
    const blocks = [r, sr].map((h) => (h.block && !r.annex && !sr.annex && rowsMin > 0 ? cabinsFor(h, x1 - x0, rowsMin) : null));
    if (blocks.some((b) => b)) {
      const ids = ([[r, -1], [sr, 1]] as const).map(([h, sign], side) => {
        const b = blocks[side], d = (y: number): number => sign * y;
        if (!b && h.fill) {
          const m = fillCols(x0, x1, (tx) => inner.hi(tx));
          for (const [tx, v] of m) paintFill(v, tx, d, Infinity);
          return m.get(x0)?.id ?? hall;
        }
        if (!b) { const id = g.room(h.role, { spec: h }); paint(id, x0, x1, (y) => d(y) >= BAND); return id; }
        // Each corridor a hall of its own, so its cabins' doors face it (not the spine).
        const stubs = b.stubs.map((st) => { const id = g.hall('hall'); paint(id, x0 + st.c0, x0 + st.c1, (y) => d(y) >= BAND + st.r0 && d(y) <= BAND + st.r1); return { id, st }; });
        const rooms = b.cabins.map(({ rect: c, spec }) => {
          const own = stubs.find(({ st }) => st.c0 === c.c1 || st.c1 === c.c0)?.id ?? hall;
          const id = g.room('quarters', { spec, access: [own] });
          paint(id, x0 + c.c0, x0 + c.c1, (y) => d(y) >= BAND + c.r0 && d(y) <= BAND + c.r1);
          return id;
        });
        // The floor past the cabins: a hold each side of the corridor, opening onto it.
        for (const c of b.rest) {
          const own = stubs.find(({ st }) => st.c0 === c.c1 || st.c1 === c.c0)?.id ?? hall;
          let f = 0;
          for (let tx = x0 + c.c0; tx < x0 + c.c1; tx++) for (let ty = -H; ty <= H; ty++) if (inside(tx, ty) && d(ty) >= BAND + c.r0) f++;
          paint(g.room('cargo', { spec: fillerSpec('hold', f), access: [own] }), x0 + c.c0, x0 + c.c1, (y) => d(y) >= BAND + c.r0 && d(y) <= BAND + c.r1);
        }
        return rooms[0] as number;
      }) as [number, number];
      for (let tx = x0; tx < x1; tx++) innerIds.set(tx, ids);
      continue;
    }
    let a = 0;
    for (let tx = x0; tx < x1; tx++) a += Math.max(0, inner.hi(tx));
    // Cabins no thinner than the rule for any room: at most `DEEP` times as deep as long.
    const cabinLen = Math.max(CABIN, Math.ceil(a / Math.max(1, x1 - x0) / DEEP) + 1);
    // A row of cabins all one width (three to five floor columns, the length divides evenly), as many as near its beds.
    const L1 = x1 - x0 + 1, beds = Math.max(r.block ? r.mods.length : 0, sr.block ? sr.mods.length : 0);
    const even = Array.from({ length: L1 }, (_, i) => i + 1).filter((q) => q <= beds && L1 % q === 0 && L1 / q - 1 >= Math.max(3, cabinLen - 1) && L1 / q - 1 <= 5);
    const k = beds === 0 ? 1 : (even.sort((p, q) => Math.abs(p - beds) - Math.abs(q - beds))[0]
      ?? Math.max(1, Math.min(beds, Math.floor(a / CABIN_AREA), Math.floor(L1 / cabinLen))));
    // The side that is no cabin block is one room the row's length.
    const whole: (number | undefined)[] = [undefined, undefined];
    const fm = [r, sr].map((h) => (h.fill ? fillCols(x0, x1, (tx) => (capped.has(tx) ? Math.min(inner.hi(tx), di) : inner.hi(tx))) : null));
    // A room run out to the hull past its cap, on a cross corridor: cut along its depth, the far part opening onto that
    // corridor and a filler taking the rest (guns keep the hull side, a filler on the spine; others the spine side).
    const cr = crossAt({ x0, x1 });
    let dTwo = Infinity, f2 = 0;
    for (let tx = x0; tx < x1; tx++) { dTwo = Math.min(dTwo, inner.hi(tx)); f2 += inner.hi(tx); }
    const two = [r, sr].map((h, side) => {
      if (k !== 1 || h.annex || h.fill || h.block || capped.size > 0 || dTwo < 2 * MIN_DEPTH + 1 || f2 <= 1.15 * maxArea(h)) return null;
      // Off a cross corridor, a corridor stub of its own down the piece's end column farther from other corridors (none
      // nearer than two rooms' width), spine to hull, for the far part.
      const near = (c: number): number => Math.min(...cross.map((q) => Math.min(Math.abs(c - q), Math.abs(c - q - CW + 1))), ...stubCols.map((q) => Math.abs(c - q)));
      const at = near(x0) > near(x1 - 1) ? x0 : x1 - 1;
      if (cr < 0 && (x1 - x0 < MIN_DEPTH + 3 || near(at) < 2 * MIN_DEPTH + 4)) return null;
      if (cr < 0 && side === 0) stubCols.push(at);
      const stub = cr < 0 ? g.hall('hall') : -1, len = x1 - x0 - (cr < 0 ? 2 : 0), from = cr < 0 && at === x0 ? x0 + 2 : x0, keep = Math.min(dTwo - MIN_DEPTH - 1, Math.max(MIN_DEPTH, Math.ceil(maxArea(h) / len))), out = roomKind(h) === 'guns';
      const via = [cr < 0 ? stub : cr === dockAt ? docks[side] as number : hall], rows = out ? dTwo - keep - 2 : keep - 1;
      const room = g.room(h.role, { spec: h, ...(out ? { access: via } : {}) });
      // The filler part within the fillers' size: on the spine, cut along its length; behind, cut by rows (each on the
      // cross corridor). Columns or row bands to rooms.
      if (out) return { room, rows, stub, at, cols: fillCols(from, from + len, () => rows + 1), bands: [] as [number, number, number][] };
      const back = dTwo - rows - 2, m = Math.max(1, Math.min(Math.floor((back + 1) / (MIN_DEPTH + 1)), Math.ceil((back * len) / FILL_MAX)));
      const bands = Array.from({ length: m }, (_, j): [number, number, number] => {
        const r0 = rows + 2 + Math.round((j * (back + 1)) / m), r1 = j === m - 1 ? Infinity : rows + 2 + Math.round(((j + 1) * (back + 1)) / m) - 2;
        const spec = fillerFor(fillsLeft, len * Math.min(back, r1 - r0 + 1), Math.min(back, r1 - r0 + 1), false);
        return [g.room(spec.role, { spec, access: via }), r0, r1];
      });
      return { room, rows, stub, at, cols: null, bands };
    });
    for (let c = 0; c < k; c++) {
      const c0 = x0 + Math.round(((x1 - x0 + 1) * c) / k), c1 = x0 + Math.round(((x1 - x0 + 1) * (c + 1)) / k) - 1;
      // A cabin block too shallow for two rows of cabins: a row of cabins on the spine, its beds shared out.
      const part = (spec: RoomSpec): RoomSpec => (!spec.block ? spec
        : { ...spec, mods: [...spec.mods.filter((_, j) => j % k === c), 'module.storage_locker'], w: c1 - c0, cabin: true, block: false });
      const one = (spec: RoomSpec, side: 0 | 1): number => (two[side] ? (two[side]?.cols?.get(c0)?.id ?? two[side]?.room as number) : spec.fill ? (fm[side]?.get(c0)?.id ?? hall) : spec.block ? g.room(spec.role, { spec: part(spec) }) : (whole[side] ??= g.room(spec.role, { spec })));
      const n = one(r, 0), s = one(sr, 1);
      for (let tx = c0; tx < c1; tx++) innerIds.set(tx, [n, s]);
      // An annex (a trauma room, a pantry) stands behind its host, the host keeping the corridor rows, a wall row
      // between and a door only into the host; where the piece is too shallow for two rooms, at its stern end instead.
      // (Columns under an outer room are the host's alone: the annex stands behind it on the rest.)
      let dMin = Infinity, all = Infinity;
      for (let tx = c0; tx < c1; tx++) { all = Math.min(all, inner.hi(tx)); if (!capped.has(tx)) dMin = Math.min(dMin, inner.hi(tx)); }
      if (dMin === Infinity) dMin = all;
      const behind = dMin >= 2 * MIN_DEPTH + 1;
      const hostRows = (h: RoomSpec): number => (h.annex && k === 1 && behind ? dMin - 1 - Math.min(dMin - MIN_DEPTH - 1, Math.max(MIN_DEPTH, Math.round((dMin * h.annex.w * h.annex.h) / full(h)))) : Infinity);
      const annexAt = (h: RoomSpec): number => (h.annex && k === 1 && !behind ? c1 - Math.min(c1 - c0 - MIN_DEPTH - 1, Math.max(MIN_DEPTH, Math.round(((c1 - c0) * h.annex.w * h.annex.h) / full(h)))) : c1);
      const ids = [n, s].map((id, side) => { const h = side === 0 ? r : sr; return h.annex && k === 1 ? g.room(h.annex.role, { spec: h.annex, access: [id] }) : id; });
      for (let tx = c0; tx < c1; tx++) {
        const deep = capped.has(tx) ? BAND + Math.min(inner.hi(tx), di) : Infinity;
        ([[r, n, -1], [sr, s, 1]] as const).forEach(([h, id, sign], side) => {
          const annex = ids[side] as number, rows = hostRows(h), d = (y: number): number => sign * y;
          const own = fm[side];
          if (own) { const f = own.get(tx); if (f !== undefined) paintFill(f, tx, d, deep); return; }
          const t = two[side];
          if (t && t.stub >= 0 && Math.abs(tx - t.at) <= 1 && tx >= x0 && tx < x1 && (tx === t.at || tx === (t.at === x0 ? x0 + 1 : x1 - 2))) {
            if (tx === t.at) paint(t.stub, tx, tx + 1, (y) => d(y) >= BAND);
            return;
          }
          if (t?.cols) {
            const f = t.cols.get(tx);
            if (f !== undefined) paintFill(f, tx, d, BAND + t.rows);
            paint(t.room, tx, tx + 1, (y) => d(y) >= BAND + t.rows + 2);
            return;
          }
          if (t) {
            paint(t.room, tx, tx + 1, (y) => d(y) >= BAND && d(y) <= BAND + t.rows);
            for (const [id, r0, r1] of t.bands) paint(id, tx, tx + 1, (y) => d(y) >= BAND + r0 && d(y) <= BAND + r1);
            return;
          }
          paint(tx < annexAt(h) ? id : annex, tx, tx + 1, (y) => d(y) >= BAND && d(y) <= Math.min(deep, BAND + rows));
          if (rows < Infinity) paint(annex, tx, tx + 1, (y) => d(y) >= BAND + rows + 2 && d(y) <= deep);
        });
      }
    }
  }
  const engines: [number, number] = [g.room('engine', { spec: engine, doorFirst: true }), g.room('engine', { spec: engine, doorFirst: true })];
  paint(engines[0], xS + 1, W, (y) => y <= -BAND && (!sternOuter || -y <= BAND + used));
  paint(engines[1], xS + 1, W, (y) => y >= BAND && (!sternOuter || y <= BAND + used));
  // An outer room opens onto a cross corridor it touches, else into the room in front of it (matched above).
  for (const slot of outerCut) {
    const { pair: [r, sr], x0, x1 } = slot;
    const front = x0 > xS ? engines : (innerIds.get(slot.at ?? Math.floor((x0 + x1) / 2)) ?? engines);
    const lo = (x: number): number => BAND + outer.lo(x);
    const access = (side: 0 | 1): number[] => (crossAt(slot) < 0 ? [front[side]] : crossAt(slot) === dockAt ? [docks[side]] : [hall]);
    const as = (h: RoomSpec): RoomSpec => (h.fill ? fillerSpec('hold', (x1 - x0) * Math.max(1, outer.hi(x0) - outer.lo(x0) + 1)) : h);
    paint(g.room(r.role, { spec: as(r), access: access(0), doorFirst: x0 > xS }), x0, x1, (y) => y <= -lo(x0));
    paint(g.room(sr.role, { spec: as(sr), access: access(1), doorFirst: x0 > xS }), x0, x1, (y) => y >= lo(x0));
  }
  for (let tx = 0; tx < W; tx++) for (let ty = -H; ty <= H; ty++) if (inside(tx, ty) && g.at(ox + tx, ty) === SPACE) g.set(ox + tx, ty, SOLID);
  for (let tx = xBr; tx < W; tx++) for (let ty = -1; ty <= 1; ty++) if (inside(tx, ty)) g.set(ox + tx, ty, hall);
  // The cross corridor out to the airlocks.
  paint(docks[0], dockAt, dockAt + CW, (y) => y <= -BAND);
  paint(docks[1], dockAt, dockAt + CW, (y) => y >= BAND);
  if (aft > 0) paint(hall, aft, aft + CW, (y) => Math.abs(y) >= BAND);
  return { g };
}
