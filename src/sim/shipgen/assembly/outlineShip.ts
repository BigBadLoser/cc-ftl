import type { ModuleDef } from '../../registry';
import { Rng } from '../../rng';
import { drawSilhouette, type Silhouette } from '../hull/silhouette';
import { NAVY_PROFILES } from '../hull/navyProfiles';
import { fitShell, seedOf } from '../generate';
import { ENGINE_TIERS, REACTOR_TIERS, planShip, reactorsFor, type ShipPlan } from '../plan';
import type { FactionDef, GenResult } from '../types';
import { layoutBlocks, type Mask } from './blockLayout';
import { gunsAndReactors } from './pairs';
import { NAVY_TYPES, navyAttempts, navyRole, shipCommons, shipQuarters, type NavyType } from './navyShip';
import { SPACE, type RegionGrid } from './regions';

/**
 * Navy hulls outline first (SHIPGEN_V4): the type's silhouette is drawn, scaled until the plan's rooms fit, and the
 * rooms are cut into it. Every outline tile is painted to a region and `compile` writes the walls, so the hull wall
 * is the outline's own edge. The rooms are cut by `layoutBlocks` (corridors, blocks, one splitter).
 */

/**
 * The silhouette at `sx` times its length and `sy` its beam, as a mask about the centre row: `inside(x, y)` with y = 0 the
 * axis. Only the body scales across; what stands beyond it (a stern flare, wings, pods) keeps its size in tiles, out from
 * the scaled body's edge.
 */

function scaled(sil: Silhouette, sx: number, sy: number): Mask {
  const W0 = Math.round(sil.length * sx);
  const bodyAt = (c: number): number => sil.body[Math.min(c, sil.body.length - 1)] as number;
  const H0 = Math.max(...sil.body.map((b) => Math.round(b * sy) + sil.axis - b));
  const base = (x: number, y: number): boolean => {
    if (x < 0 || x >= W0 || Math.abs(y) > H0) return false;
    const c = Math.floor(x / sx), b = bodyAt(c), hb = Math.round(b * sy), d = Math.abs(y);
    // Rounded by distance from the axis, so the two sides mirror (Math.round takes -2.5 to -2 but 2.5 to 3).
    const raw = d <= hb ? Math.round(d / sy) : b + d - hb;
    return sil.rows[sil.axis + Math.sign(y) * raw]?.[c] === '#';
  };
  // PROTOTYPE (#581): the gun battery on the widest straight stretch, lengthened (its middle column repeated) until it
  // holds it: two blisters a tile proud (a gun room's floor and a wall either side), the airlock between, maintenance
  // corridor between them. A third gun stands inboard of the aft one, the column doubled.
  const bat = sil.battery, guns = bat?.guns ?? 0, k = Math.min(guns, 2), run = bat?.runs[0], GW = (bat?.w ?? 4) + 2, GAP = 7, AIR = 3;
  const sites: [number, number][] = [];
  let E = 0, mid = W0, air = -1, a0 = 0, b0 = 0;
  if (k > 0 && run) {
    const A = Math.ceil(run[0] * sx) + 1, B = Math.floor(run[1] * sx) - 1, need = k * GW + AIR + (k + 2) * GAP;
    E = Math.max(0, need - (B - A));
    mid = Math.floor((A + B) / 2);
    a0 = A + Math.floor((B + E - A - need) / 2);
    let x = a0 + GAP;
    for (let i = 0; i <= k; i++) {
      if (i === Math.ceil(k / 2)) { air = x; x += AIR + GAP; }
      if (i < k) { sites.push([x, x + GW]); x += GW + GAP; }
    }
    b0 = x;
  }
  const from = (x: number): number => (x < mid ? x : x < mid + E ? mid : x - E);
  const hull = (x: number, y: number): boolean => base(from(x), y);
  const topOf = (x: number): number => { let y = 0; while (hull(x, y + 1)) y++; return y; };
  // Proud enough that a gun room's floor rows end where the two-row corridor's do (its inner wall the corridor's).
  const P = Math.max(1, (bat?.h ?? 3) - 2);
  const proud = (x: number, y: number): boolean => (sites.some(([s0, s1]) => x >= s0 && x < s1) || (air >= 0 && x >= air && x < air + AIR)) && Math.abs(y) > topOf(x) && Math.abs(y) <= topOf(x) + P;
  const inside = (x: number, y: number): boolean => hull(x, y) || proud(x, y);
  const battery = sites.length > 0 ? { battery: { a: a0, b: b0, guns: sites, rows: bat?.h ?? 3, air, inner: guns > k ? [k - 1] : [] } } : {};
  return { W: W0 + E, H: H0 + (sites.length > 0 ? P : 0), inside, ...battery };
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

/**
 * Floor a room cannot reach (a sliver of hull beyond a neck that compiles to wall: an embrasure's tooth) goes back to
 * space, the outline shaved there. Whether any went.
 */
function dropIslands(g: RegionGrid): boolean {
  const cell = g.compile(), half = g.half, size = 2 * half;
  const floor = (x: number, y: number): boolean => x >= -half && y >= -half && x < half && y < half && cell[(y + half) * size + x + half] === '_';
  const seen = new Set<number>(), parts = new Map<number, number[][]>();
  for (let y = -half; y < half; y++) for (let x = -half; x < half; x++) {
    const k = (y + half) * size + x + half, r = g.at(x, y);
    if (seen.has(k) || r < 0 || !floor(x, y)) continue;
    const part: number[] = [], stack = [[x, y] as const];
    seen.add(k);
    while (stack.length > 0) {
      const [cx, cy] = stack.pop() as readonly [number, number];
      part.push((cy + half) * size + cx + half);
      for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]] as const) {
        const nk = (ny + half) * size + nx + half;
        if (!seen.has(nk) && floor(nx, ny) && g.at(nx, ny) === r) { seen.add(nk); stack.push([nx, ny]); }
      }
    }
    parts.set(r, [...(parts.get(r) ?? []), part]);
  }
  let dropped = false;
  for (const ps of parts.values()) {
    ps.sort((a, b) => b.length - a.length);
    for (const p of ps.slice(1)) for (const k of p) { g.set((k % size) - half, Math.floor(k / size) - half, SPACE); dropped = true; }
  }
  return dropped;
}

/** What an outline is built from: the plan with the type's commons and quarters, the drawn silhouette, the rooms' size draws. */
export interface OutlineInputs { rng: Rng; role: ReturnType<typeof navyRole>; plan: ShipPlan; sil: Silhouette; vary: number[]; maxBeam: number }

export function outlineInputs(
  f: FactionDef, seed: number, depth: number, defs: Record<string, ModuleDef>, type: NavyType, n = 0, extra = 0, sites = false,
): OutlineInputs {
  const rng = new Rng(seedOf(seed, n));
  const role = navyRole(f, type);
  // A drive short of thrust gets engines a tier up before it gets more of them (more need a deeper stern, so a bigger hull).
  const engineUp = ENGINE_TIERS[ENGINE_TIERS.indexOf(planShip(new Rng(seedOf(seed, n)), f, role, depth, defs).kit.engine as (typeof ENGINE_TIERS)[number]) + 1];
  const tierUp = extra > 0 && !!engineUp && !!defs[engineUp];
  const planned = planShip(rng, f, role, depth, defs, tierUp ? extra - 1 : extra);
  // A reactor a tier up where the plan's is Mk I: the power the fit-out would otherwise squeeze into stores as extra reactors.
  const up = REACTOR_TIERS[Math.min(REACTOR_TIERS.length - 1, REACTOR_TIERS.indexOf(planned.kit.reactor as (typeof REACTOR_TIERS)[number]) + 1)] as string;
  const kit = { ...planned.kit, ...(planned.kit.reactor === REACTOR_TIERS[0] && defs[up] ? { reactor: up } : {}), ...(tierUp ? { engine: engineUp } : {}) };
  // The type's commons and quarters (a few spare beds past the crew's) join the plan, their power counted.
  const quarters = shipQuarters(type, planned.quarters, planned.crew.length, rng.int(2, 4));
  const plan: ShipPlan = { ...planned, kit, quarters, support: [...planned.support, ...shipCommons(type, planned.crew.length)] };
  plan.reactors = reactorsFor(plan, defs);
  // PROTOTYPE (#581): with `sites`, a notched gun site per gun pair in place of the profile's embrasures.
  const gp = gunsAndReactors(plan, defs).gunPairs;
  const sil = drawSilhouette(rng, rng.pick(NAVY_PROFILES[type] ?? []), sites ? gp.length : undefined);
  if (sil.battery) Object.assign(sil.battery, { w: Math.max(...gp.flat().map((r) => r.w)), h: Math.max(3, ...gp.flat().map((r) => r.h)) });
  const vary = Array.from({ length: 24 }, () => rng.int(80, 135) / 100);
  return { rng, role, plan, sil, vary, maxBeam: NAVY_TYPES[type].maxBeam };
}

/**
 * The smallest beam the rooms fit, at a length from three quarters of it up: near the silhouette's proportions. No
 * wider than the type's beam (its hull walls included): at the widest, the hull grows longer.
 */
export function scaleSearch<T>(sil: Silhouette, maxBeam: number, fit: (m: Mask) => T | null): { m: Mask; l: T } | null {
  const at = (sx: number, sy: number): { m: Mask; l: T } | null => {
    const m = scaled(sil, sx, sy);
    if (2 * m.H + 3 > maxBeam) return null;
    const l = fit(m);
    return l ? { m, l } : null;
  };
  let widest = 1;
  for (let sy = 1; sy <= 3.6 && 2 * scaled(sil, 1, sy).H + 3 <= maxBeam; sy += 0.1) {
    widest = sy;
    for (let sx = Math.max(1, 0.75 * sy); sx <= 1.15 * sy; sx += 0.1) { const l = at(sx, sy); if (l) return l; }
  }
  for (let sx = 1.15 * widest + 0.1; sx <= 3 * widest; sx += 0.1) { const l = at(sx, widest); if (l) return l; }
  return null;
}

export function assembleOutline(
  f: FactionDef, factionId: string, seed: number, depth: number, defs: Record<string, ModuleDef>, type: NavyType, n = 0, extra = 0,
): GenResult {
  const { rng, role, plan, sil, vary, maxBeam } = outlineInputs(f, seed, depth, defs, type, n, extra);
  const found = scaleSearch(sil, maxBeam, (m) => layoutBlocks(plan, m, type, vary, defs));
  if (!found) throw new Error(`outline ${type}: rooms do not fit`);
  const lay = found.l;
  const { g } = lay;
  thinHull(g);
  if (dropIslands(g)) thinHull(g);
  const cell = g.compile(), snap = g.snapshot(cell);
  const at = (cx: number, cy: number): string => snap.rows[cy]?.[cx] ?? '.';
  const rows = snap.rows.map((r, y) => [...r].map((c, cx) => (c === 'D' && [at(cx + 1, y), at(cx - 1, y), at(cx, y + 1), at(cx, y - 1)].includes('.') ? '#' : c)).join(''));
  return fitShell(
    rng, f, factionId, seed, role, 'sections', { crew: plan.crew } as Pick<ShipPlan, 'crew'>,
    { rows, roomOf: snap.roomOf, width: snap.width, height: snap.height, roles: g.regions.map((r) => r.role), specs: g.regions.map((r) => r.spec) },
    `outline ${type}`, defs, n, { bareHalls: true },
  );
}

/** An outline navy ship by attempts (as `generateNavy`). */
export function generateOutline(f: FactionDef, factionId: string, seed: number, depth: number, defs: Record<string, ModuleDef>, type: NavyType): GenResult {
  return navyAttempts(defs, (n, extra) => assembleOutline(f, factionId, seed, depth, defs, type, n, extra));
}
