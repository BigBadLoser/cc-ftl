import { Rng } from '../rng';
import type { ModuleDef, ShipTemplate } from '../registry';
import { Builder } from './builder';
import type { Arranger } from './arranger';
import { arrangeHull } from './navyLayouts';
import { layoutMetrics, metricViolation } from './metrics';
import { roleOfLetter } from './canvas';
import { pruneDoors } from './rooms';
import { stockOf, toTemplate } from './fitted';
import { fitOut, type ExtraCheck, type FinishOpts } from './fitOut';
export type { ExtraCheck, FinishOpts } from './fitOut';
import { hullChoices, pickWeighted, planShip, type RoomSpec, type ShipPlan } from './plan';
import { clusters, hub, rails } from './topoDrone';
import { ring, spine } from './topoNavy';
import { salvage } from './topoSalvage';
import { trimThin } from './salvage';
import { validateTemplate } from './validate';
import { equipmentShort, plannedEquipment, type Equipment } from './equipment';
import { templateHullLoad } from '../ftl/capacity';
import { thinWalls } from './thinWalls';
import { extractContainers, type PlacedContainer } from './containerCells';
import { openBareDocks } from './openDocks';
import { erodeHull } from './erodeHull';
import type { ArchetypeId, FactionDef, GenResult, GenRoom, HullFamilyDef, RoomRole, ShipRoleDef } from './types';

/** Attempts before giving up on a seed (each reseeds deterministically). */
export const GEN_ATTEMPTS = 24;

/** Seed for attempt `n` of `seed` (shared with the station generator). */
export const seedOf = (seed: number, n: number): number => attemptSeed(seed, n);

/** Seed for attempt `n` of `seed`. */
const attemptSeed = (seed: number, n: number): number => (Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) + Math.imul(n, 0xc2b2ae35)) >>> 0;

type Topology = (b: Builder, f: FactionDef, plan: ShipPlan) => string | null;
const TOPOLOGIES: Record<Exclude<ArchetypeId, 'sections'>, Topology> = {
  spine, ring: (b, f, p) => ring(b, f, p), carrier: (b, f, p) => ring(b, f, p, true), hub, rails, clusters, salvage,
};

/** Pick a ship role (weights scaled by depth) and one of its archetypes. */
function pickRole(rng: Rng, f: FactionDef, depth: number, seed: number): { role: ShipRoleDef; archetype: ArchetypeId } {
  const role = hullOf(rng, f, seed, depth) as ShipRoleDef;
  return { role, archetype: pickWeighted(rng, role.archetypes) };
}

/** The hull family (or ship role) a seed builds: the first draw of its first attempt. */
const seedHull = (f: FactionDef, seed: number, depth: number): HullFamilyDef | ShipRoleDef => pickWeighted(new Rng(attemptSeed(seed, 0)), hullChoices(f, depth));

/**
 * The hull family (or ship role) of an attempt: the seed's, for every attempt, so a reseed rebuilds the same family and the ship is what
 * `previewHull` said (a roster slot gets the size it asked for, #577). The attempt still makes its own draw, so its later draws stay in step.
 */
function hullOf(rng: Rng, f: FactionDef, seed: number, depth: number): HullFamilyDef | ShipRoleDef {
  pickWeighted(rng, hullChoices(f, depth));
  return seedHull(f, seed, depth);
}

/** The hull family (or ship role) id a seed builds, without building anything: every attempt builds the same one (`hullOf`). */
export const previewHull = (f: FactionDef, seed: number, depth: number): string => seedHull(f, seed, depth).id;

/** What a hull's problem begins with when its engines cannot carry it. */
const CAPACITY_PROBLEM = 'engines carry';

/** Times an attempt is built again with more engines when its hull came out bigger than its engines carry. */
const ENGINE_TOP_UPS = 3;

/** Engines a hull lacks to carry itself (`templateHullLoad`), at the capacity of the engines it has; 0 when it fits. */
export function enginesShort(defs: Record<string, ModuleDef>, t: Pick<ShipTemplate, 'rows' | 'modules'>): number {
  const load = templateHullLoad(defs, t);
  return load.over > 0 && load.engines > 0 ? Math.ceil(load.over / (load.capacity / load.engines)) : 0;
}

/**
 * One generation attempt (attempt `n` of `seed`): the result, or the stage that failed. A hull its planned engines cannot carry is built
 * again from the same seed with the engines it lacks added to the plan (the extra drives grow the hull a little, so each build checks
 * again), up to `ENGINE_TOP_UPS` times; one still over fails `fitShell`'s check and is reseeded.
 */
export function generateAttempt(
  f: FactionDef, factionId: string, seed: number, depth: number, defs: Record<string, ModuleDef>, n: number,
): GenResult | string {
  let extra = 0;
  for (let k = 0; ; k++) {
    const r = buildAttempt(f, factionId, seed, depth, defs, n, extra, k < ENGINE_TOP_UPS);
    if (typeof r !== 'number') return r;
    extra += r;
  }
}

/** One build of an attempt with `extraEngines` over the budget. With `topUp`, a hull short of engines returns how many it lacks instead. */
function buildAttempt(
  f: FactionDef, factionId: string, seed: number, depth: number, defs: Record<string, ModuleDef>, n: number, extraEngines: number, topUp: boolean,
): GenResult | string | number {
  const rng = new Rng(attemptSeed(seed, n));
  let role: ShipRoleDef;
  let archetype: ArchetypeId;
  let plan: ShipPlan;
  let b: Builder;
  let topology: string | null;
  let comp: Arranger | null = null;
  let profile = '';
  let planned: Equipment;
  if (f.hullFamilies && f.hullFamilies.length > 0) {
    // Assembly-driven: a hull family, its standard sections, composed by constraints.
    const fam = hullOf(rng, f, seed, depth) as HullFamilyDef;
    role = { id: fam.id, weight: fam.weight, archetypes: [], ...(fam.bonus ? { bonus: fam.bonus } : {}), ...(fam.bays ? { bays: fam.bays } : {}) };
    archetype = 'sections';
    plan = planShip(rng, f, role, depth, defs, extraEngines, fam.hullPerRoomTile);
    planned = plannedEquipment(defs, plan);
    const r = arrangeHull(rng, f, fam, plan, defs);
    if (typeof r === 'string') return `${fam.id}: ${r}`;
    comp = r.A;
    b = r.b;
    plan = r.plan;
    profile = r.profile;
    topology = r.profile;
  } else {
    ({ role, archetype } = pickRole(rng, f, depth, seed));
    plan = planShip(rng, f, role, depth, defs, extraEngines);
    planned = plannedEquipment(defs, plan);
    b = new Builder(rng);
    topology = TOPOLOGIES[archetype as Exclude<ArchetypeId, 'sections'>](b, f, plan);
  }
  if (!topology) return `${archetype}: structure clash`;
  const r = { ...finishLayout(rng, f, factionId, seed, role, archetype, plan, b, topology, comp, profile, defs, n), planned };
  // The guns, shields, point defence and bays the plan asked for are required: a ship that lost any is reseeded (#577).
  const short = equipmentShort(defs, planned, r.template);
  if (short) r.problems.push(short);
  // Only a ship that failed on its engines alone is built again: any other problem reseeds it anyway.
  const after = topUp && r.problems[0]?.startsWith(CAPACITY_PROBLEM) ? enginesShort(defs, r.template) : 0;
  return after > 0 ? after : r;
}


/**
 * Crop the built structure, fit it out, make the template, validate it and take metrics: the shared back half of a
 * generation attempt (ships and stations).
 */
export function finishLayout(
  rng: Rng, f: FactionDef, factionId: string, seed: number, role: ShipRoleDef, archetype: ArchetypeId, plan: ShipPlan, b: Builder,
  topology: string, comp: Arranger | null, profile: string, defs: Record<string, ModuleDef>, n: number,
  opts: { immobile?: boolean; check?: ExtraCheck } = {},
): GenResult {
  b.cv.fixDoors();
  const labels = b.cv.labels;
  const roleOfLabel = (l: { chunk: string; letter: string }): RoomRole => b.chunkRoles.get(`${l.chunk}:${l.letter}`) ?? roleOfLetter(l.letter) ?? 'cargo';
  const partByKey = new Map(b.parts.map((p) => [p.key, p.spec]));
  // One wall between parts: slabs become floor, spare hull layers and double partitions go (thinWalls.ts).
  const KEEP: readonly RoomRole[] = ['dock', 'engine', 'hangar'];
  const thin = thinWalls(b.cv, {
    canGrow: (i) => {
      const l = labels[i];
      if (!l) return false;
      const spec = partByKey.get(l.chunk) ?? b.chunkSpecs.get(`${l.chunk}:${l.letter}`);
      return !spec?.sealed && !KEEP.includes(roleOfLabel(l));
    },
    rank: (i) => (labels[i] && roleOfLabel(labels[i] as { chunk: string; letter: string }) === 'hall' ? 1 : 0),
    axis2: b.axis2,
  });
  // Footprint width rule: bare wall stubs under 3 tiles wide that the arrangers and the wall thinning leave are taken off.
  trimThin(b);
  b.cv.fixDoors();
  const { rows: drawn, labels: roomOf, width, height, ox, oy } = b.cv.crop();
  const roles = labels.map((l) => roleOfLabel(l));
  const { rows: framed, containers } = extractContainers(drawn);
  const pruned = pruneDoors(framed, roomOf, width, roles);
  // Salvage builds: the welds leave slabs of plating around the rooms; the hull is trimmed back to one tile (erodeHull.ts).
  const rows = f.salvage ? erodeHull(pruned, width).rows : pruned;
  const specs = specsOf(b);
  return {
    ...fitShell(rng, f, factionId, seed, role, archetype, plan, { rows, roomOf, width, height, roles, specs, containers }, topology, defs, n, opts,
      comp ? (hall) => comp.debug(ox, oy, width, height, rows, hall, profile) : undefined),
    thin,
  };
}

/** The planned contents of each room the builder drew, by room label. */
function specsOf(b: Builder): (RoomSpec | undefined)[] {
  const byKey = new Map(b.parts.map((p) => [p.key, p.spec]));
  return b.cv.labels.map((l) => byKey.get(l.chunk) ?? b.chunkSpecs.get(`${l.chunk}:${l.letter}`));
}

/** A built structure, cropped: its tiles, the room of each floor tile, and each room's role and planned contents. */
export interface Shell {
  rows: string[];
  roomOf: Int16Array;
  width: number;
  height: number;
  roles: RoomRole[];
  specs: (RoomSpec | undefined)[];
  /** Cargo containers standing outside the hull, already placed. */
  containers?: readonly PlacedContainer[];
}

/**
 * Fit a shell out, make the template, validate it and take metrics. The arranger's structures come here through
 * `finishLayout`; the station assembly (`assembly/station.ts`) hands its shell over directly.
 */
export function fitShell(
  rng: Rng, f: FactionDef, factionId: string, seed: number, role: ShipRoleDef, archetype: ArchetypeId, plan: Pick<ShipPlan, 'crew'>, shell: Shell,
  topology: string, defs: Record<string, ModuleDef>, n: number, opts: FinishOpts = {},
  debug?: (hall: (x: number, y: number) => boolean) => GenResult['debug'],
): GenResult {
  const { rows, roomOf, width, height, roles, specs } = shell;
  const d = fitOut(rng, f, rows, roomOf, roles, specs, defs, opts);
  // Airlock-only docks open into the corridor they border (wall and door go; openDocks.ts).
  const opened = d.error ? { merged: 0, walled: 0, tiles: [] } : openBareDocks(d.lay);
  const docks = { merged: opened.merged, walled: opened.walled };
  const dockTile = new Set(opened.tiles);
  const fitted = opened.merged > 0 ? rows.map((r, y) => d.lay.cells.slice(y * d.lay.w, y * d.lay.w + r.length).join('')) : rows;
  const template = toTemplate(f, role, factionId, seed, plan, fitted, d);
  // Modules standing apart (entered from their own rooms, or cabled on the ground as such): each structure is checked on its own.
  if ((opts.entries?.size ?? 0) > 0 || (opts.ground?.apart?.length ?? 0) > 0) template.apart = true;
  template.modules = [...(template.modules ?? []), ...(shell.containers ?? []).map((k) => ({ ...k, ...stockOf(rng, f, defs[k.def]) }))];
  const problems = d.error ? [d.error] : validateTemplate(template, defs, opts.immobile ? { immobile: true } : {});
  if (problems.length === 0 && opts.check) problems.push(...opts.check(template, defs));
  // A generated ship that jumps carries its hull on its engines (ftl/capacity.ts), as the player's does (#129). Hand-drawn hulls are not held to it.
  const load = opts.immobile ? null : templateHullLoad(defs, template);
  if (problems.length === 0 && load && load.over > 0) problems.push(`${CAPACITY_PROBLEM} ${load.capacity} of ${load.tiles} tiles`);
  const hall = (x: number, y: number): boolean => roles[roomOf[y * width + x] ?? -1] === 'hall' && !dockTile.has(y * width + x);
  const metrics = layoutMetrics(template, hall, defs);
  const bad = metricViolation(metrics, f.metrics);
  if (bad && problems.length === 0) problems.push(bad);
  const rooms: GenRoom[] = roles.map((r, id) => ({ id, role: r, tiles: d.lay.roomTiles(id) }));
  return {
    template, rooms, roomOf, width, height, role: role.id, archetype, topology, attempts: n + 1, problems, failures: [], metrics, docks,
    ...(debug ? { debug: debug(hall) } : {}),
  };
}

/**
 * Generate a ship for a faction, deterministically from `seed` and sector `depth`: role and archetype, module plan,
 * structure, fit-out, validation. Bad layouts are reseeded up to GEN_ATTEMPTS times.
 */
export function generateShip(
  f: FactionDef, factionId: string, seed: number, depth: number, defs: Record<string, ModuleDef>,
): GenResult {
  let last: GenResult | null = null;
  const failures: string[] = [];
  for (let n = 0; n < GEN_ATTEMPTS; n++) {
    const r = generateAttempt(f, factionId, seed, depth, defs, n);
    if (typeof r === 'string') { failures.push(r); continue; }
    last = { ...r, failures: [...failures] };
    if (r.problems.length === 0) return last;
    failures.push(`${r.archetype}: ${r.problems[0]}`);
  }
  if (last) return { ...last, failures };
  throw new Error(`generateShip: no layout for ${factionId} seed ${seed} depth ${depth}: ${failures.join(', ')}`);
}
