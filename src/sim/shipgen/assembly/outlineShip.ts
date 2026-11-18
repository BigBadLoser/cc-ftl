import type { ModuleDef } from '../../registry';
import { Rng } from '../../rng';
import { drawSilhouette, type Silhouette } from '../hull/silhouette';
import { NAVY_PROFILES } from '../hull/navyProfiles';
import { enginesShort, fitShell, seedOf } from '../generate';
import { cargoSpec, dockSpec, engineSpec, planShip, reactorSpec, type RoomSpec, type ShipPlan } from '../plan';
import { pairUp } from '../topoNavy';
import type { FactionDef, GenResult } from '../types';
import { NAVY_TYPES, navyRole, type NavyType } from './navyShip';
import { RegionGrid, SOLID, SPACE } from './regions';

/**
 * Navy hulls outline first (SHIPGEN_V4): the type's silhouette is drawn, scaled until the plan's rooms fit, and the
 * rooms are cut into it. Every outline tile is painted to a region and `compile` writes the walls, so the hull wall
 * is the outline's own edge. Bow to stern: the bridge fills the nose; a corridor three wide runs down the centre row;
 * the side bands either side of it are sliced into rooms (mirrored pairs, guns forward where the wings stand out);
 * a cross hall three wide meets the corridor at the stern, the drive bank behind it, stacked across the beam.
 */

/** Side bands: rows out from the axis. The corridor is rows -1..1, its wall row 2, room floor from row 3. */
const BAND = 2;
/** Floor rows a column of side band needs to count as room (narrower columns stay plating). */
const MIN_DEPTH = 3;
const ZONE = ['weapons', 'bridge', 'shields', 'core', 'dock', 'quarters', 'support', 'plant', 'cargo', 'hangar', 'reactor'];

/** The silhouette at `sx` times its length and `sy` its beam, as a mask about the centre row: `inside(x, y)` with y = 0 the axis. */
function scaled(sil: Silhouette, sx: number, sy: number): { W: number; H: number; inside: (x: number, y: number) => boolean } {
  const W = Math.round(sil.length * sx), H = Math.round(sil.axis * sy);
  const inside = (x: number, y: number): boolean => {
    if (x < 0 || x >= W || Math.abs(y) > H) return false;
    const row = sil.rows[sil.axis + Math.round(y / sy)];
    return row?.[Math.floor(x / sx)] === '#';
  };
  return { W, H, inside };
}

interface Layout { g: RegionGrid }

/** Rooms cut into the outline at one scale, or null when they do not fit. */
function layout(plan: ShipPlan, sil: Silhouette, sx: number, sy: number, type: NavyType): Layout | null {
  const { W, H, inside } = scaled(sil, sx, sy);
  if (2 * H + 4 > 120 || W + 4 > 240) return null;
  const g = new RegionGrid(128);
  const ox = -Math.floor(W / 2);
  const top = (x: number): number => { let y = 0; while (inside(x, y + 1)) y++; return inside(x, 0) ? y : -1; };
  const depth = (x: number): number => top(x) - BAND - 1; // floor rows of side band (its outer row is hull wall)
  let xEnd = W - 1;
  while (xEnd > 0 && !inside(xEnd, 0)) xEnd--;

  // The stern: the corridor runs to the stern hull, the engines either side of it against the stern, each side's
  // stacked in one room off the corridor's end. Reactors stand in the side bands, last of their rooms.
  // A stern deep enough for more stacks them (a flared stern is full of engines rather than empty engine room).
  const one = engineSpec(1, 'w', plan.kit);
  const xS = xEnd - one.w - 1; // the wall column ahead of the engine rooms
  let sternDepth = Infinity;
  for (let tx = xS + 1; tx <= xEnd; tx++) sternDepth = Math.min(sternDepth, depth(tx));
  const perSide = Math.max(Math.ceil(plan.engines / 2), Math.min(3, Math.floor(sternDepth / one.h)));
  const engine = engineSpec(perSide, 'w', plan.kit);
  if (sternDepth < engine.h) return null;
  const reactors: RoomSpec[] = Array.from({ length: plan.reactors }, () => reactorSpec(1, plan.kit));

  // The bow: the bridge at the nose tip, sized to its plan. Behind it, where the hull is still too narrow for side
  // rooms, the corridor opens out to the hull (an entry hall) rather than leave a wall more than a tile thick.
  const bridge = plan.command;
  let xBr = 0, area = 0;
  while (xBr < xS && (area < 1.3 * bridge.w * bridge.h || top(xBr) < 2)) { area += Math.max(0, 2 * top(xBr) - 1); xBr++; }
  let xBand = xBr + 1;
  while (xBand < xS && depth(xBand) < MIN_DEPTH - 1) xBand++;
  if (xBand >= xS - 6) return null;

  // Side rooms, paired to mirror, bow to stern by zone (guns forward).
  const guns = plan.weapons;
  const rest = [...reactors, ...plan.shields, ...(plan.core ? [plan.core] : []), dockSpec(), dockSpec(), ...plan.quarters, ...plan.support, ...plan.cargo, ...plan.hangars]
    .sort((a, b) => ZONE.indexOf(a.role) - ZONE.indexOf(b.role));
  const [gn, gs] = pairUp(guns);
  const [rn, rs] = pairUp(rest);
  const north = [...gn, ...rn], south = [...gs, ...rs];
  if (NAVY_TYPES[type].guns === 'spread' && gn.length > 1) {
    // Spread: the first pair forward, the rest one between every few rooms.
    const every = Math.max(1, Math.floor(rn.length / (gn.length - 1)));
    const weave = (gun: RoomSpec[], rr: RoomSpec[]): RoomSpec[] => gun.flatMap((r, i) => [r, ...rr.slice(i * every, (i + 1) * every)]).concat(rr.slice(gun.length * every));
    north.splice(0, north.length, ...weave(gn, rn)); south.splice(0, south.length, ...weave(gs, rs));
  }
  // Slice the bands: each pair takes columns until its floor area is met. The band's floor is shared out in proportion
  // to the rooms' planned areas, so no one room takes the slack. A plating column, one tile thick, stands between rooms.
  const bandArea = (x: number): number => Math.max(0, depth(x));
  let avail = 0;
  for (let bx = xBand; bx < xS; bx++) avail += bandArea(bx);
  const want = north.reduce((t, r) => t + r.w * r.h, 0);
  const full = Math.max(1, avail / Math.max(1, want) - 0.15);
  // Docks wait for a straight stretch of hull (an airlock needs a flat outer wall): each is cut at the first straight
  // run reached, the other rooms in their zone order round it.
  const pairs = north.map((r, i) => [r, south[i] as RoomSpec] as const);
  const flat = (x0: number, w: number): boolean => { for (let k = -1; k <= w; k++) if (top(x0 + k) !== top(x0) || depth(x0 + k) < MIN_DEPTH) return false; return true; };
  const slice = (share: number): { order: (readonly [RoomSpec, RoomSpec])[]; cuts: [number, number][] } | null => {
    const docks = pairs.filter(([r]) => r.role === 'dock');
    const queue = pairs.filter(([r]) => r.role !== 'dock');
    const order: (readonly [RoomSpec, RoomSpec])[] = [];
    const cuts: [number, number][] = [];
    let x = xBand;
    while (queue.length > 0 || docks.length > 0) {
      const dock = docks.length > 0 && (flat(x, (docks[0] as readonly [RoomSpec, RoomSpec])[0].w) || queue.length === 0);
      const pair = (dock ? docks.shift() : queue.shift()) as readonly [RoomSpec, RoomSpec];
      const r = pair[0];
      const x0 = x;
      let a = 0;
      // A reactor lies along its back wall (the hull), so its room is at least its length long; others at least their short side.
      const len = dock ? r.w : r.role === 'reactor' ? r.w : Math.min(r.w, r.h);
      if (dock) { if (!flat(x, r.w)) return null; x += r.w; a = r.w * r.h; }
      else while (x < xS && (a < r.w * r.h * share || x - x0 < len)) { a += bandArea(x); x++; }
      if (a < r.w * r.h || x - x0 < len || x > xS) return null;
      order.push(pair);
      cuts.push([x0, x]);
      x++; // the plating column between
    }
    return { order, cuts };
  };
  // The fullest share that fits, down to the plan's own sizes.
  const cut = slice(full) ?? slice((1 + full) / 2) ?? slice(1);
  if (!cut) return null;
  const { order, cuts } = cut;
  // The last room runs on to the drive section's wall; a dock last leaves its bay as cut and the gap to the drive
  // section is the corridor's (an open alcove).
  const lastDock = order[order.length - 1]?.[0].role === 'dock';
  if (cuts.length > 0 && !lastDock) (cuts[cuts.length - 1] as [number, number])[1] = xS;

  const paint = (id: number, x0: number, x1: number, yIn: (y: number) => boolean): void => {
    for (let tx = x0; tx < x1; tx++) for (let ty = -H; ty <= H; ty++) if (inside(tx, ty) && yIn(ty)) g.set(ox + tx, ty, id);
  };
  paint(g.room(bridge.role, { spec: bridge }), 0, xBr, () => true);
  // Plating fills only the one-tile gaps the cuts leave between rooms (painted last, below).
  order.forEach(([r, sr], i) => {
    const [x0, x1] = cuts[i] as [number, number];
    // An airlock bay is open to the corridor: a hall with its fixture, through the corridor's wall row.
    const make = (spec: RoomSpec): number => (spec.role === 'dock' ? g.hall('dock', undefined, spec) : g.room(spec.role, { spec }));
    const from = r.role === 'dock' ? BAND - 1 : 1;
    paint(make(r), x0, x1, (y) => y < -from);
    paint(make(sr), x0, x1, (y) => y > from);
  });
  for (let tx = 0; tx < W; tx++) for (let ty = -H; ty <= H; ty++) if (inside(tx, ty) && g.at(ox + tx, ty) === SPACE) g.set(ox + tx, ty, SOLID);
  paint(g.room('engine', { spec: engine }), xS + 1, W, (y) => y <= -BAND);
  paint(g.room('engine', { spec: engine }), xS + 1, W, (y) => y >= BAND);
  const hall = g.hall('hall');
  for (let tx = xBr; tx < W; tx++) for (let ty = -1; ty <= 1; ty++) if (inside(tx, ty)) g.set(ox + tx, ty, hall);
  if (lastDock) { const x0 = (cuts[cuts.length - 1] as [number, number])[1]; paint(hall, x0, xS + 1, (y) => Math.abs(y) < top(0) + H); }
  // The entry hall: the corridor out to the hull where the bands are too shallow for rooms.
  for (let tx = xBr; tx < xBand; tx++) for (let ty = -H; ty <= H; ty++) if (inside(tx, ty)) g.set(ox + tx, ty, hall);
  return { g };
}

/**
 * No wall more than a tile thick: a wall tile with no floor beside it (8 ways) goes. On the hull (open space beside it)
 * it becomes space, the outline shaved by a tile; inside, it becomes floor of the room beside it.
 */
function thinHull(g: RegionGrid): void {
  for (let pass = 0; pass < 4; pass++) {
    const cell = g.compile(), half = g.half, size = 2 * half;
    const c = (x: number, y: number): string => (x < -half || y < -half || x >= half || y >= half ? '.' : (cell[(y + half) * size + x + half] as string));
    let changed = false;
    for (let y = -half + 1; y < half - 1; y++) for (let x = -half + 1; x < half - 1; x++) {
      if (c(x, y) !== '#') continue;
      let floor = false, space = false;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const k = c(x + dx, y + dy);
        if (k === '_' || k === 'D') floor = true;
        if (k === '.' && (dx === 0 || dy === 0)) space = true;
      }
      if (floor) continue;
      if (space) { g.set(x, y, SPACE); changed = true; continue; }
      const near = [g.at(x + 1, y), g.at(x - 1, y), g.at(x, y + 1), g.at(x, y - 1)].find((r) => r >= 0);
      if (near !== undefined) { g.set(x, y, near); changed = true; }
    }
    if (!changed) return;
  }
}

export function assembleOutline(
  f: FactionDef, factionId: string, seed: number, depth: number, defs: Record<string, ModuleDef>, type: NavyType, n = 0, extra = 0,
): GenResult {
  const rng = new Rng(seedOf(seed, n));
  const role = navyRole(f, type);
  const plan = planShip(rng, f, role, depth, defs, extra);
  const profiles = NAVY_PROFILES[type] ?? [];
  const sil = drawSilhouette(rng, rng.pick(profiles));
  let lay: Layout | null = null;
  // The smallest beam the rooms fit, at a length from three quarters of it up: near the silhouette's proportions.
  for (let sy = 1.2; sy <= 3.6 && !lay; sy += 0.1) for (let sx = Math.max(1, 0.75 * sy); sx <= 1.15 * sy && !lay; sx += 0.1) lay = layout(plan, sil, sx, sy, type);
  if (!lay) throw new Error(`outline ${type}: rooms do not fit`);
  const { g } = lay;
  thinHull(g);
  const cell = g.compile(), snap = g.snapshot(cell);
  const at = (cx: number, cy: number): string => snap.rows[cy]?.[cx] ?? '.';
  const rows = snap.rows.map((r, y) => [...r].map((c, cx) => (c === 'D' && [at(cx + 1, y), at(cx - 1, y), at(cx, y + 1), at(cx, y - 1)].includes('.') ? '#' : c)).join(''));
  return fitShell(
    rng, f, factionId, seed, role, 'sections', { crew: plan.crew } as Pick<ShipPlan, 'crew'>,
    { rows, roomOf: snap.roomOf, width: snap.width, height: snap.height, roles: g.regions.map((r) => r.role), specs: g.regions.map((r) => r.spec) },
    `outline ${type}`, defs, n,
  );
}

/** Attempts until one passes (as `generateNavy`), the last otherwise; a hull its engines cannot carry is built again with more. */
export function generateOutline(f: FactionDef, factionId: string, seed: number, depth: number, defs: Record<string, ModuleDef>, type: NavyType): GenResult {
  const failures: string[] = [];
  let last: GenResult | null = null;
  for (let n = 0; n < 24; n++) {
    let r = assembleOutline(f, factionId, seed, depth, defs, type, n);
    for (let k = 0, extra = 0; k < 3 && r.problems[0]?.startsWith('engines carry'); k++) {
      extra += Math.max(1, enginesShort(defs, r.template));
      r = assembleOutline(f, factionId, seed, depth, defs, type, n, extra);
    }
    last = { ...r, failures: [...failures] };
    if (r.problems.length === 0) return last;
    failures.push(r.problems[0] as string);
  }
  return last as GenResult;
}
