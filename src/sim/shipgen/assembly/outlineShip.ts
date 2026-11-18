import type { ModuleDef } from '../../registry';
import { Rng } from '../../rng';
import { drawSilhouette, type Silhouette } from '../hull/silhouette';
import { NAVY_PROFILES } from '../hull/navyProfiles';
import { enginesShort, fitShell, seedOf } from '../generate';
import { dockSpec, engineSpec, planShip, reactorSpec, type RoomSpec, type ShipPlan } from '../plan';
import { pairUp } from '../topoNavy';
import type { FactionDef, GenResult } from '../types';
import { NAVY_TYPES, navyRole, type NavyType } from './navyShip';
import { RegionGrid, SOLID } from './regions';

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
  // The stern: the drive bank's rooms, a centre room on the axis and mirrored pairs out from it.
  const items: RoomSpec[] = [];
  let eLeft = plan.engines, rLeft = plan.reactors;
  let mid: RoomSpec;
  if (eLeft % 2 === 1) { mid = engineSpec(1, 'w', plan.kit); eLeft--; } else { const k = Math.min(rLeft % 2 === 1 ? 1 : 2, rLeft); mid = reactorSpec(k, plan.kit); rLeft -= k; }
  while (eLeft > 0 || rLeft > 0) {
    if (rLeft > 0) { const k = Math.min(2, Math.ceil(rLeft / 2)); items.push(reactorSpec(k, plan.kit)); rLeft -= Math.min(rLeft, 2 * k); }
    if (eLeft > 0) { items.push(engineSpec(1, 'w', plan.kit)); eLeft -= 2; }
  }
  items.sort((p, q) => (p.role === 'engine' ? 1 : 0) - (q.role === 'engine' ? 1 : 0));
  const sternW = Math.max(mid.w, ...items.map((r) => r.w));
  // The bank's floor runs to the last column that holds the centre row; its rooms take every outline tile aft of the cross hall.
  let xEnd = W - 1;
  while (xEnd > 0 && !inside(xEnd, 0)) xEnd--;
  let xBank = xEnd - sternW - 1; // the bank's first column is wall (the hall outranks it), floor from xBank + 1
  // A stern that stands out past the body (a flare, quarters, swept wings) is the drive bank's: the cross hall moves
  // forward to where it starts, so the bank fills it rather than the last side room.
  const body = top(Math.floor(xEnd / 2));
  while (xBank > xEnd / 2 && top(xBank - 4) > body) xBank--;
  const xCross = xBank - 3; // the cross hall, three wide
  const need = (mid.h + (mid.h % 2 === 0 ? 1 : 0)) / 2 + items.reduce((t, r) => t + r.h + 1, 0);
  if (Math.min(...[xBank + 1, xEnd - 1].map(top)) - 1 < need) return null;

  // The bow: the bridge takes the nose back to where its floor area is met and the side bands are deep enough for rooms.
  const bridge = plan.command;
  let xBr = 0, area = 0;
  while (xBr < xCross && (area < bridge.w * bridge.h || depth(xBr) < MIN_DEPTH + 1)) { area += Math.max(0, 2 * top(xBr) - 1); xBr++; }
  if (xBr >= xCross - 4) return null;

  // Side rooms, paired to mirror, bow to stern by zone (guns forward).
  const guns = plan.weapons;
  const rest = [...plan.shields, ...(plan.core ? [plan.core] : []), dockSpec(), dockSpec(), ...plan.quarters, ...plan.support, ...plan.cargo, ...plan.hangars]
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
  // Slice the bands: each pair takes columns until its floor area is met (a wall column between rooms).
  // The band's floor is shared out in proportion to the rooms' planned areas, so no one room takes the slack.
  const bandArea = (x: number): number => Math.max(0, depth(x) >= MIN_DEPTH ? depth(x) : 0);
  let avail = 0;
  for (let bx = xBr + 1; bx < xCross; bx++) avail += bandArea(bx);
  const want = north.reduce((t, r) => t + r.w * r.h, 0);
  const share = Math.max(1, (avail - north.length * (depth(Math.floor((xBr + xCross) / 2)))) / Math.max(1, want));
  // Docks wait for a straight stretch of hull (an airlock needs a flat outer wall): each is cut at the first straight
  // run reached, the other rooms in their zone order round it.
  const pairs = north.map((r, i) => [r, south[i] as RoomSpec] as const);
  const docks = pairs.filter(([r]) => r.role === 'dock');
  const queue = pairs.filter(([r]) => r.role !== 'dock');
  const order: (readonly [RoomSpec, RoomSpec])[] = [];
  const cuts: [number, number][] = [];
  const flat = (x0: number, w: number): boolean => { for (let k = -1; k <= w; k++) if (top(x0 + k) !== top(x0) || depth(x0 + k) < MIN_DEPTH) return false; return true; };
  let x = xBr + 1;
  while (queue.length > 0 || docks.length > 0) {
    const dock = docks.length > 0 && (flat(x, (docks[0] as readonly [RoomSpec, RoomSpec])[0].w) || queue.length === 0);
    const pair = (dock ? docks.shift() : queue.shift()) as readonly [RoomSpec, RoomSpec];
    const r = pair[0];
    const x0 = x;
    let a = 0;
    if (dock) { if (!flat(x, r.w)) return null; x += r.w; a = r.w * r.h; }
    else while (x < xCross && (a < r.w * r.h * share || x - x0 < Math.min(r.w, r.h))) { a += bandArea(x); x++; }
    if (a < r.w * r.h || x > xCross) return null;
    order.push(pair);
    cuts.push([x0, x]);
    x++; // the wall between
  }
  if (cuts.length > 0 && (order[order.length - 1] as readonly [RoomSpec, RoomSpec])[0].role !== 'dock') (cuts[cuts.length - 1] as [number, number])[1] = xCross;

  // Paint: plating first (every outline tile), then rooms, then halls over them.
  for (let tx = 0; tx < W; tx++) for (let ty = -H; ty <= H; ty++) if (inside(tx, ty)) g.set(ox + tx, ty, SOLID);
  const paint = (id: number, x0: number, x1: number, yIn: (y: number) => boolean): void => {
    for (let tx = x0; tx < x1; tx++) for (let ty = -H; ty <= H; ty++) if (inside(tx, ty) && yIn(ty)) g.set(ox + tx, ty, id);
  };
  paint(g.room(bridge.role, { spec: bridge }), 0, xBr + 1, () => true);
  order.forEach(([r, sr], i) => {
    const [x0, x1] = cuts[i] as [number, number];
    paint(g.room(r.role, { spec: r }), x0, x1, (y) => y < -BAND);
    paint(g.room(sr.role, { spec: sr }), x0, x1, (y) => y > BAND);
  });
  // The wall columns between side rooms go to the room ahead (it gives way by rank, so the wall stands there).
  // Bank: the centre room on the axis, pairs out from it, the outermost taking what is left of the outline.
  // Floor rows are counted out from the axis with a plating row between rooms, so every room keeps its planned depth.
  const mh = mid.h + (mid.h % 2 === 0 ? 1 : 0), m2 = (mh - 1) / 2;
  paint(g.room(mid.role, { spec: mid }), xBank, W, (y) => Math.abs(y) <= m2);
  let edge = m2 + 1; // the plating row past the last room
  items.forEach((r, i) => {
    const y0 = edge + 1, y1 = i === items.length - 1 ? H + 1 : y0 + r.h - 1;
    paint(g.room(r.role, { spec: r }), xBank, W, (y) => y >= y0 && y <= y1);
    paint(g.room(r.role, { spec: r }), xBank, W, (y) => -y >= y0 && -y <= y1);
    edge = y1 + 1;
  });
  const hall = g.hall('hall');
  for (let tx = xBr; tx < xCross; tx++) for (let ty = -1; ty <= 1; ty++) g.set(ox + tx, ty, hall);
  for (let tx = xCross; tx < xBank; tx++) for (let ty = -H; ty <= H; ty++) if (inside(tx, ty) && Math.abs(ty) < top(tx)) g.set(ox + tx, ty, hall);
  return { g };
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
