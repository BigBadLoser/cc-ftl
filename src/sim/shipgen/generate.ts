import { Rng } from '../rng';
import type { ModuleDef } from '../registry';
import { Builder } from './builder';
import type { Arranger } from './arranger';
import { arrangeHull } from './navyLayouts';
import { roleOfLetter } from './canvas';
import { pruneDoors } from './rooms';
import type { ExtraCheck } from './fitOut';
export type { ExtraCheck, FinishOpts } from './fitOut';
import { hullChoices, pickWeighted, planShip, type RoomSpec, type ShipPlan } from './plan';
import { clusters, hub, rails } from './topoDrone';
import { ring, spine } from './topoNavy';
import { salvage } from './topoSalvage';
import { trimThin } from './salvage';
import { equipmentShort, plannedEquipment, type Equipment } from './equipment';
import { thinWalls } from './thinWalls';
import { extractContainers } from './containerCells';
import { erodeHull } from './erodeHull';
import { regrid } from './assembly/regrid';
import { generateOutline } from './assembly/outlineShip';
import { outlineTypeOf } from './assembly/outlineType';
import { CAPACITY_PROBLEM, enginesShort, fitShell, seedHull, seedOf } from './shell';
export { builtFamily, enginesShort, fitShell, previewHull, seedOf, type Shell } from './shell';
import type { ArchetypeId, FactionDef, GenResult, HullFamilyDef, RoomRole, ShipRoleDef } from './types';

/** Attempts before giving up on a seed (each reseeds deterministically). */
export const GEN_ATTEMPTS = 24;

type Topology = (b: Builder, f: FactionDef, plan: ShipPlan) => string | null;
const TOPOLOGIES: Record<Exclude<ArchetypeId, 'sections'>, Topology> = {
  spine, ring: (b, f, p) => ring(b, f, p), carrier: (b, f, p) => ring(b, f, p, true), hub, rails, clusters, salvage,
};

/** Pick a ship role (weights scaled by depth) and one of its archetypes. */
function pickRole(rng: Rng, f: FactionDef, depth: number, seed: number): { role: ShipRoleDef; archetype: ArchetypeId } {
  const role = hullOf(rng, f, seed, depth) as ShipRoleDef;
  return { role, archetype: pickWeighted(rng, role.archetypes) };
}

/**
 * The hull family (or ship role) of an attempt: the seed's, for every attempt, so a reseed rebuilds the same family and the ship is what
 * `previewHull` said (a roster slot gets the size it asked for, #577). The attempt still makes its own draw, so its later draws stay in step.
 */
function hullOf(rng: Rng, f: FactionDef, seed: number, depth: number): HullFamilyDef | ShipRoleDef {
  pickWeighted(rng, hullChoices(f, depth));
  return seedHull(f, seed, depth);
}

/** Times an attempt is built again with more engines when its hull came out bigger than its engines carry. */
const ENGINE_TOP_UPS = 3;

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
  const rng = new Rng(seedOf(seed, n));
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
  const KEEP0: readonly RoomRole[] = ['dock', 'engine', 'hangar'];
  if (f.regrid) {
    // The drawing as it stands, its walls and doors settled on the region grid (assembly/regrid.ts).
    const { rows: drawn, labels: lab, width, height, oy } = b.cv.crop();
    const { rows: framed, containers } = extractContainers(drawn);
    const roles = labels.map((l) => roleOfLabel(l));
    const specs = specsOf(b);
    const shell = regrid({ rows: framed, labels: lab, width, height, roles, specs, grow: true, ...(f.architecture.symmetry > 0 ? { axis2: b.axis2 - 2 * oy } : {}), canGrow: (i) => !specs[i]?.sealed && !KEEP0.includes(roles[i] as RoomRole) });
    return fitShell(rng, f, factionId, seed, role, archetype, plan, { ...shell, containers }, topology, defs, n, opts);
  }
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

/**
 * Generate a ship for a faction, deterministically from `seed` and sector `depth`: role and archetype, module plan,
 * structure, fit-out, validation. Bad layouts are reseeded up to GEN_ATTEMPTS times. The one owner of which generator
 * builds a faction's ships: a seed whose hull family has an outline recipe (the navy's, the civilian liner and freighter)
 * its type's outline hull (assembly/outlineShip.ts), the rest by their hull families or roles (the arranger).
 */
export function generateShip(
  f: FactionDef, factionId: string, seed: number, depth: number, defs: Record<string, ModuleDef>,
): GenResult {
  const type = outlineTypeOf(f, seed, depth);
  if (type) return generateOutline(f, factionId, seed, depth, defs, type);
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
