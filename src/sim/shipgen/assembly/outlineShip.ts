import type { ModuleDef } from '../../registry';
import { Rng } from '../../rng';
import { drawSilhouette, type Drive, type Profile, type Silhouette } from '../hull/silhouette';
import { fitShell, seedOf } from '../generate';
import type { BaysLayout, OutlineRecipe } from '../outlineRecipe';
import { ENGINE_TIERS, REACTOR_TIERS, engineSpec, planShip, reactorsFor, type ShipPlan } from '../plan';
import type { FactionDef, GenResult } from '../types';
import { layoutBlocks, type Mask } from './blockLayout';
import { bayRooms, type BayRules } from './bayRooms';
import { partOf } from './parts';
import { deptsOf } from './zones';
import { outlineFrame } from './frame';
import { paintPlaced } from './placePaint';
import type { Placed } from './placeLayout';
import { gunsAndReactors } from './pairs';
import { outlineAttempts, outlineRole, recipeOf, shipCommons, shipQuarters } from './outlineType';
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
  // A rounded section's columns sampled from its nearer end, so its two ends mirror whatever the scale.
  const colOf = (x: number): number => {
    for (const [a, b] of sil.round ?? []) {
      const X0 = Math.round(a * sx), X1 = Math.round((b + 1) * sx) - 1;
      if (x < X0 || x > X1) continue;
      const e = Math.min(b - a, Math.floor(Math.min(x - X0, X1 - x) / sx));
      return x - X0 <= X1 - x ? a + e : b - e;
    }
    return Math.floor(x / sx);
  };
  const base = (x: number, y: number): boolean => {
    if (x < 0 || x >= W0 || Math.abs(y) > H0) return false;
    const c = colOf(x), b = bodyAt(c), hb = Math.round(b * sy), d = Math.abs(y);
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
    const A = Math.ceil(run[0] * sx) + 1, B = Math.floor(run[1] * sx) - 1, need = k * GW + AIR + 2 + (k + 2) * GAP;
    E = Math.max(0, need - (B - A));
    mid = Math.floor((A + B) / 2);
    a0 = A + Math.floor((B + E - A - need) / 2);
    let x = a0 + GAP;
    for (let i = 0; i <= k; i++) {
      if (i === Math.ceil(k / 2)) { air = x + 1; x += AIR + 2 + GAP; }
      if (i < k) { sites.push([x, x + GW]); x += GW + GAP; }
    }
    b0 = x;
  }
  const from = (x: number): number => (x < mid ? x : x < mid + E ? mid : x - E);
  const hull = (x: number, y: number): boolean => base(from(x), y);
  const topOf = (x: number): number => { let y = 0; while (hull(x, y + 1)) y++; return y; };
  // Proud enough that a gun room's floor rows end where the two-row corridor's do (its inner wall the corridor's).
  const P = Math.max(1, (bat?.h ?? 3) - 2);
  const proud = (x: number, y: number): boolean => (sites.some(([s0, s1]) => x >= s0 && x < s1) || (air >= 0 && x >= air - 1 && x <= air + AIR)) && Math.abs(y) > topOf(x) && Math.abs(y) <= topOf(x) + P;
  const inside = (x: number, y: number): boolean => hull(x, y) || proud(x, y);
  const battery = sites.length > 0 ? { battery: { a: a0, b: b0, guns: sites, rows: bat?.h ?? 3, air, inner: guns > k ? [k - 1] : [] } } : {};
  return { W: W0 + E, H: H0 + (sites.length > 0 ? P : 0), inside, scale: [sx, sy], ...battery };
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
    // (A hall may run in pieces: the battery's corridor, between its gun rooms.)
    if (seen.has(k) || r < 0 || !floor(x, y) || g.regions[r]?.hall) continue;
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
export interface OutlineInputs {
  rng: Rng; role: ReturnType<typeof outlineRole>; plan: ShipPlan; sil: Silhouette; vary: number[]; maxBeam: number;
  /** The silhouette's profile (its recipe's). */
  profile: string;
  /** On bays, the same silhouette with its drive section drawn again, a tile wider each (`DRIVE_REDRAWS` of them). */
  drives: Silhouette[];
  /** On bays, the plan with its engines a tier up, where there is a tier up: a drive's other choice. */
  planUp?: ShipPlan;
  /**
   * On a lane hull, the hull drawn with its lane each half-width from the widest down (`LANES`), the rest the same: its
   * own drive section then the redraws, each; and whether its side corridors have rooms both sides (else outboard only).
   */
  lanes?: Silhouette[][]; both?: boolean;
}

/** Drive sections a bay hull may draw in place of its own, each a tile wider, where its own holds too few engines. */
const DRIVE_REDRAWS = 4;
/** Rows between a bay hull's engines. */
const ENGINE_GAP = 2;
/** A lane hull's lane half-widths, widest first: narrower where its side hulls are too shallow for their rooms. */
const LANES = [8, 7, 6, 5, 4, 3];
/** A hull's floor against its mask's tiles, about (walls and corridors out). */
const LIT = 0.3;

export function outlineInputs(
  f: FactionDef, seed: number, depth: number, defs: Record<string, ModuleDef>, type: string, n = 0, extra = 0,
): OutlineInputs {
  const rng = new Rng(seedOf(seed, n));
  const recipe = recipeOf(f, type), bay = recipe.layout.kind === 'bays' ? recipe.layout : undefined;
  const role = outlineRole(f, type, recipe);
  // A drive short of thrust gets engines a tier up before it gets more of them (more need a deeper stern, so a bigger hull).
  const engineUp = ENGINE_TIERS[ENGINE_TIERS.indexOf(planShip(new Rng(seedOf(seed, n)), f, role, depth, defs).kit.engine as (typeof ENGINE_TIERS)[number]) + 1];
  const tierUp = extra > 0 && !!engineUp && !!defs[engineUp];
  const planned = planShip(rng, f, role, depth, defs, tierUp ? extra - 1 : extra);
  // A reactor a tier up where the plan's is Mk I: the power the fit-out would otherwise squeeze into stores as extra reactors.
  const up = REACTOR_TIERS[Math.min(REACTOR_TIERS.length - 1, REACTOR_TIERS.indexOf(planned.kit.reactor as (typeof REACTOR_TIERS)[number]) + 1)] as string;
  const kit = { ...planned.kit, ...(planned.kit.reactor === REACTOR_TIERS[0] && defs[up] ? { reactor: up } : {}), ...(tierUp ? { engine: engineUp } : {}) };
  // The type's commons and quarters (a few spare beds past the crew's, its passengers' cabins) join the plan, their power counted.
  const quarters = shipQuarters(recipe, planned.quarters, planned.crew.length, rng.int(2, 4), depth);
  const plan: ShipPlan = { ...planned, kit, quarters, support: [...planned.support, ...shipCommons(recipe, planned.crew.length, depth)] };
  const fixed = recipe.engines;
  if (fixed) plan.engines = fixed + (tierUp ? extra - 1 : extra);
  plan.reactors = reactorsFor(plan, defs);
  const next = ENGINE_TIERS[ENGINE_TIERS.indexOf(kit.engine as (typeof ENGINE_TIERS)[number]) + 1];
  const planUp: ShipPlan | undefined = bay && next && defs[next] ? { ...plan, kit: { ...kit, engine: next } } : undefined;
  if (planUp) planUp.reactors = reactorsFor(planUp, defs);
  // PROTOTYPE (#581): on bays, the drive's choices (engines a tier up, wider drive sections, a flare held an engine room
  // deep); with a battery, a notched gun site per gun pair in place of the profile's embrasures.
  const sites = !!bay?.battery;
  const gp = gunsAndReactors(plan, defs).gunPairs;
  const profile = rng.pick(recipe.profiles as Profile[]), from = rng.getState();
  // A bay hull's flare holds its full width an engine room deep (the deepest engine it may take, a walk column and wall).
  const hold = bay ? engineSpec(1, 'w', planUp?.kit ?? kit).w + 2 : 0;
  const draw = (drive?: Drive, lane?: number): Silhouette => {
    rng.setState(from);
    const p = lane && profile.split ? { ...profile, split: { ...profile.split, lane: [lane, lane] as const } } : profile;
    const s = drawSilhouette(rng, p, sites ? gp.length : undefined, { ...drive, hold });
    if (s.battery) Object.assign(s.battery, { w: Math.max(...gp.flat().map((r) => r.w)), h: Math.max(3, ...gp.flat().map((r) => r.h)) });
    return s;
  };
  // (The redraws first, from the hull's own draws: the rng runs on from the hull's own as though there were none.)
  const redraws = (lane?: number): Silhouette[] => (bay ? Array.from({ length: DRIVE_REDRAWS }, (_, k) => draw({ rng: new Rng(seedOf(seed, 1000 + 16 * n + k)), grow: k + 1 }, lane)) : []);
  const drives = redraws();
  const lanes = bay?.lane && profile.split ? LANES.map((l) => [draw(undefined, l), ...redraws(l)]) : undefined;
  // (Its own draw, so the corridor style leaves the hull's draws as they were.)
  const both = lanes ? new Rng(seedOf(seed, 2000 + n)).chance(0.5) : undefined;
  const sil = draw();
  const vary = Array.from({ length: 24 }, () => rng.int(80, 135) / 100);
  return { rng, role, plan, sil, drives, vary, maxBeam: recipe.maxBeam, profile: profile.id, ...(planUp ? { planUp } : {}), ...(lanes ? { lanes, both } : {}) };
}

/**
 * The smallest beam the rooms fit, at a length from three quarters of it up: near the silhouette's proportions. No
 * wider than the type's beam (its hull walls included): at the widest, the hull grows longer. `least` is the smallest
 * beam scale tried, `squash` how far under its beam's scale the length's may go, `shortest` the length's least scale.
 */
export function scaleSearch<T>(sil: Silhouette, maxBeam: number, fit: (m: Mask) => T | null, least = 1, squash = 0.75, shortest = least): { m: Mask; l: T } | null {
  const at = (sx: number, sy: number): { m: Mask; l: T } | null => {
    const m = scaled(sil, sx, sy);
    if (2 * m.H + 3 > maxBeam) return null;
    const l = fit(m);
    return l ? { m, l } : null;
  };
  let widest = least;
  for (let sy = least; sy <= 3.6 && 2 * scaled(sil, 1, sy).H + 3 <= maxBeam; sy += 0.1) {
    widest = sy;
    for (let sx = Math.max(shortest, squash * sy); sx <= 1.15 * sy; sx += 0.1) { const l = at(sx, sy); if (l) return l; }
  }
  for (let sx = 1.15 * widest + 0.1; sx <= 3 * widest; sx += 0.1) { const l = at(sx, widest); if (l) return l; }
  return null;
}

function blockGrid(plan: ShipPlan, sil: Silhouette, maxBeam: number, defs: Record<string, ModuleDef>, r: OutlineRecipe, vary: number[]): RegionGrid {
  const found = scaleSearch(sil, maxBeam, (m) => layoutBlocks(plan, m, r, vary, defs));
  if (!found) throw new Error(`outline ${r.family}: rooms do not fit`);
  return found.l.g;
}

/**
 * Bay layouts: the first few hull sizes the rooms fit (a quick search each, none past a quarter longer than the first), the
 * best of them by fit and length, searched again in full. At each size the hull takes the first drive that holds the
 * engines its size needs: its own drive section (`sils[0]`) with the plan's engines, then with engines a tier up (`plans`),
 * then each wider drive section the same way. The rest of the hull is the same in each.
 */
function bayGrid(plans: ShipPlan[], lanes: Silhouette[][], maxBeam: number, defs: Record<string, ModuleDef>, r: OutlineRecipe, bay: BaysLayout, both?: boolean): RegionGrid {
  const cands: { W: number; l: Placed; plan: ShipPlan }[] = [], rules: BayRules = { depts: deptsOf(r.depts), part: partOf(bay) };
  // A lane hull's corridor style: rooms both sides of its side corridors where any size holds them, else outboard only.
  for (const style of both === undefined ? [undefined] : both ? [true, false] : [false]) {
    const lane = style === undefined ? undefined : { both: style };
    scaleSearch((lanes[0] as Silhouette[])[0] as Silhouette, maxBeam, (m0) => {
      // (Past a quarter longer than the first fit, a hull is never the best: stop there.)
      const first = cands[0];
      if (first && m0.W > 1.25 * first.W) return first.l;
      if (m0.W < (r.minLength ?? 0)) return null;
      const [sx, sy] = m0.scale ?? [1, 1];
      // The widest lane the rooms fit (its side hulls deep enough), at its first drive that holds the engines.
      lanes: for (const [j, sils] of lanes.entries()) for (const [k, sil] of sils.entries()) {
        const m = j === 0 && k === 0 ? m0 : scaled(sil, sx, sy);
        if (2 * m.H + 3 > maxBeam) continue;
        for (const plan of plans) {
          const fr = outlineFrame(plan, m, defs[plan.kit.engine]?.engine?.hullCapacity ?? 0, ENGINE_GAP, lane, rules.part);
          if (!fr) continue;
          // (A lane hull's floor is far past its rooms' plan: its reactors light the hull's.)
          const lit = fr.lane ? { ...plan, reactors: reactorsFor(plan, defs, Math.round(LIT * fr.area)) } : plan;
          const q = bayRooms(lit, fr, defs, 400, rules);
          if (q.viable > 0) { cands.push({ W: m.W, l: q, plan: lit }); break lanes; }
          continue lanes;
        }
      }
      return cands.length >= 4 ? (cands[cands.length - 1] as { l: Placed }).l : null;
    }, 1, 0.45, 0.45);
    if (cands.length > 0) break;
  }
  const best = cands.sort((a, b) => a.l.score + a.W / 20 - (b.l.score + b.W / 20))[0];
  if (!best) throw new Error(`outline ${r.family}: rooms do not fit`);
  return paintPlaced(best.plan, bayRooms(best.plan, best.l.fr, defs, 3000, rules));
}

export function assembleOutline(
  f: FactionDef, factionId: string, seed: number, depth: number, defs: Record<string, ModuleDef>, type: string, n = 0, extra = 0,
): GenResult {
  // PROTOTYPE (#581): a recipe with a bay layout has its rooms on bays (a cruiser along a gun battery).
  const r = recipeOf(f, type), bay = r.layout.kind === 'bays' ? r.layout : undefined;
  const { rng, role, plan, sil, drives, planUp, vary, maxBeam, profile, lanes, both } = outlineInputs(f, seed, depth, defs, type, n, extra);
  const g = bay ? bayGrid([plan, ...(planUp ? [planUp] : [])], lanes ?? [[sil, ...drives]], maxBeam, defs, r, bay, both) : blockGrid(plan, sil, maxBeam, defs, r, vary);
  thinHull(g);
  if (dropIslands(g)) thinHull(g);
  const cell = g.compile(), snap = g.snapshot(cell);
  const at = (cx: number, cy: number): string => snap.rows[cy]?.[cx] ?? '.';
  const rows = snap.rows.map((r, y) => [...r].map((c, cx) => (c === 'D' && [at(cx + 1, y), at(cx - 1, y), at(cx, y + 1), at(cx, y - 1)].includes('.') ? '#' : c)).join(''));
  return fitShell(
    rng, f, factionId, seed, role, 'sections', { crew: plan.crew } as Pick<ShipPlan, 'crew'>,
    { rows, roomOf: snap.roomOf, width: snap.width, height: snap.height, roles: g.regions.map((r) => r.role), specs: g.regions.map((r) => r.spec) },
    `outline ${profile}`, defs, n, { bareHalls: true },
  );
}

/** An outline ship of its faction's recipe `type`, by attempts. */
export function generateOutline(f: FactionDef, factionId: string, seed: number, depth: number, defs: Record<string, ModuleDef>, type: string): GenResult {
  return outlineAttempts(defs, (n, extra) => assembleOutline(f, factionId, seed, depth, defs, type, n, extra));
}
