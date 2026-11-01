import { Rng } from '../rng';
import type { ModuleDef, ShipTemplate } from '../registry';
import { Builder } from './builder';
import type { Arranger } from './arranger';
import { arrangeHull } from './navyLayouts';
import { layoutMetrics, metricViolation } from './metrics';
import { roleOfLetter } from './canvas';
import { lightRoom, placeOne, rotsOf } from './fit';
import { RECIPES, STATION_RECIPES, drawRoom, pruneDoors, reserveWalkway, furnish, placeStep, specStep, type RoomDraw } from './rooms';
import { Layout } from './layout';
import { hullChoices, pickWeighted, planShip, type RoomSpec, type ShipPlan } from './plan';
import { clusters, hub, rails } from './topoDrone';
import { ring, spine } from './topoNavy';
import { salvage } from './topoSalvage';
import { trimThin } from './salvage';
import { validateTemplate } from './validate';
import { thinWalls } from './thinWalls';
import { extractContainers } from './containerCells';
import { openBareDocks } from './openDocks';
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

/** Placement order: hull-bound and required modules first, stores last. */
const ORDER = [
  'module.engine', 'module.airlock', 'module.helm', 'module.weaponsConsole', 'module.aiCore', 'module.vehicle_bay', 'module.shieldConsole',
];
const rank = (id: string, d: ModuleDef): number => {
  const i = ORDER.indexOf(id);
  if (i >= 0) return i;
  if (d.weapon) return 10;
  if (d.pointDefense) return 11;
  if (d.shieldGen) return 12;
  if (d.power > 0) return 13;
  if (d.bed) return 14;
  return 15;
};

interface Fitted {
  /** Why the fit-out failed (the partial layout is kept for the viewer). */
  error?: string;
  lay: Layout;
  stock: Map<number, { item: string; count: number }[]>;
  vehicles: Set<number>;
}

/** Place every room's planned modules in that room; a reason string when something essential does not fit. */
function fitOut(
  rng: Rng, f: FactionDef, rows: string[], roomOf: Int16Array, roles: RoomRole[], specs: (RoomSpec | undefined)[], defs: Record<string, ModuleDef>,
  recipes = RECIPES,
): Fitted {
  const lay = new Layout(rows, roomOf, roles, defs);
  const out: Fitted = { lay, stock: new Map(), vehicles: new Set() };
  specs.forEach((spec, room) => { if (spec?.sealed) lay.sealed.add(room); });
  const jobs: { room: number; def: string; spec: RoomSpec }[] = [];
  specs.forEach((spec, room) => { for (const def of spec?.mods ?? []) jobs.push({ room, def, spec: spec as RoomSpec }); });
  jobs.sort((a, b) => (a.spec.sealed ? 0 : 1) - (b.spec.sealed ? 0 : 1) || rank(a.def, defs[a.def] as ModuleDef) - rank(b.def, defs[b.def] as ModuleDef));
  const placed: Record<string, number> = {};
  const wanted: Record<string, number> = {};
  // Rooms with a recipe draw their arrangement once; their planned modules go where the recipe says.
  const draws = new Map<number, RoomDraw>();
  const drawOf = (room: number): RoomDraw | null => {
    const recipe = recipes[roles[room] as RoomRole];
    if (!recipe || specs[room]?.sealed) return null;
    if (!draws.has(room)) {
      const d = drawRoom(rng, recipe);
      draws.set(room, d);
      reserveWalkway(lay, room, d);
    }
    return draws.get(room) as RoomDraw;
  };
  const rots = (id: string): number[] => rotsOf(id, defs[id] as ModuleDef);
  const stockUp = (idx: number, spec: RoomSpec | undefined): void => {
    const id = lay.modules[idx]?.def as string;
    if (spec?.stock && defs[id]?.storage) {
      const items = spec.items ?? f.stock;
      // An ore bin holds one ore (its sprite shows one kind): pick one from the room's stock list.
      const art = defs[id]?.storageArt;
      const ores = art ? items.filter((s) => art[s.item]) : [];
      const pick = ores.length > 0 ? [ores[rng.int(0, ores.length - 1)] as (typeof items)[number]] : items;
      out.stock.set(idx, pick.map((s) => ({ item: s.item, count: rng.int(s.min, s.max) })).filter((s) => s.count > 0));
    }
  };
  // Planned modules per room and def, for steps that place only a share of them.
  const planned = new Map<string, number>();
  for (const j of jobs) planned.set(`${j.room} ${j.def}`, (planned.get(`${j.room} ${j.def}`) ?? 0) + 1);
  const done = new Map<string, number>();
  for (const j of jobs) {
    wanted[j.def] = (wanted[j.def] ?? 0) + 1;
    const d = drawOf(j.room);
    const si = d ? specStep(d, j.def) : -1;
    const share = d && si >= 0 ? d.arr.steps[si]?.share : undefined;
    const k = `${j.room} ${j.def}`;
    if (share !== undefined && (done.get(k) ?? 0) >= Math.max(1, Math.ceil((planned.get(k) ?? 0) * share))) { wanted[j.def] = (wanted[j.def] ?? 1) - 1; continue; }
    done.set(k, (done.get(k) ?? 0) + 1);
    const pm = (d && si >= 0 ? placeStep(lay, rng, j.room, d, si, rots(j.def)) : null)
      ?? placeOne(lay, rng, j.def, [j.room], { spread: !!defs[j.def]?.weapon, ...(j.spec.sealed ? { sealed: true } : {}) });
    if (!pm) continue;
    placed[j.def] = (placed[j.def] ?? 0) + 1;
    const idx = lay.modules.length - 1;
    stockUp(idx, j.spec);
    if (j.spec.vehicle && defs[j.def]?.vehicleBay) out.vehicles.add(idx);
  }
  const missing = (id: string): boolean => (wanted[id] ?? 0) > 0 && (placed[id] ?? 0) === 0;
  for (const id of ['module.engine', 'module.helm', 'module.airlock', 'module.reactor', 'module.weaponsConsole', 'module.aiCore', 'module.vehicle_bay']) {
    if (missing(id)) return { ...out, error: `no ${id.replace('module.', '')} fits` };
  }
  const guns = (m: Record<string, number>): number => Object.entries(m).filter(([id]) => defs[id]?.weapon).reduce((t, [, n]) => t + n, 0);
  if (guns(placed) === 0 || guns(placed) * 4 < guns(wanted) * 3) return { ...out, error: 'weapons do not fit' };
  if ((placed['module.reactor'] ?? 0) < (wanted['module.reactor'] ?? 0)) return { ...out, error: 'reactors do not fit' };
  // Rooms with a recipe are lit after they are furnished, so lamps take the walkways the furniture leaves.
  for (let room = 0; room < roles.length; room++) if (!drawOf(room)) lightRoom(lay, rng, room);
  let supply = 0;
  let demand = 0;
  for (const m of lay.modules) { const p = (defs[m.def] as ModuleDef).power; if (p > 0) supply += p; else demand -= p; }
  // Lamps the furnished rooms will need (a trial lighting, taken back: they are lit after furnishing), plus a margin.
  const recipeRooms = roles.map((_, i) => i).filter((i) => drawOf(i));
  let lamps = 0;
  for (const room of recipeRooms) {
    const n = lay.modules.length;
    lightRoom(lay, rng, room);
    lamps += lay.modules.length - n;
    while (lay.modules.length > n) lay.pop();
  }
  const lampPower = -((defs['module.light'] as ModuleDef | undefined)?.power ?? 0);
  demand += lamps * lampPower;
  // Furniture can push a lamp off its first-choice tile: keep a lamp per furnished room in hand.
  const margin = recipeRooms.length * lampPower;
  // Short of power after lighting: squeeze extra reactors into engineering or stores.
  const spare = roles.map((r, i) => (r === 'reactor' || r === 'engine' || r === 'cargo' || r === 'support' ? i : -1)).filter((i) => i >= 0);
  // Station courts (lit to scale, so lamp-hungry) can take a reactor on their open floor as a last resort.
  const courts = roles.map((r, i) => (r === 'plaza' || r === 'garden' || r === 'drill' ? i : -1)).filter((i) => i >= 0);
  const reactor = defs['module.reactor'];
  for (let k = 0; k < (courts.length > 0 ? 6 : 3) && supply < demand + margin && reactor; k++) {
    if (!(k < 3 && placeOne(lay, rng, 'module.reactor', spare)) && !(courts.length > 0 && placeOne(lay, rng, 'module.reactor', courts))) break;
    supply += reactor.power;
  }
  if (supply < demand) return { ...out, error: 'not enough power' };
  // Furnishing: recipe extras that draw power (a galley) only while the planned reactors cover them, with a margin
  // kept for the lamps those rooms still need.
  const power = { spare: supply - demand - margin };
  for (const room of recipeRooms) {
    const d = drawOf(room) as RoomDraw;
    const before = lay.modules.length;
    furnish(lay, rng, room, d, rots, power);
    for (let i = before; i < lay.modules.length; i++) stockUp(i, specs[room]);
    lightRoom(lay, rng, room);
  }
  let draw = 0;
  for (const m of lay.modules) draw -= Math.min(0, (defs[m.def] as ModuleDef).power);
  if (supply < draw) return { ...out, error: 'not enough power' };
  return out;
}

function toTemplate(f: FactionDef, role: ShipRoleDef, factionId: string, seed: number, plan: ShipPlan, rows: string[], d: Fitted): ShipTemplate {
  const tag = (seed >>> 0).toString(16).toUpperCase().padStart(8, '0').slice(-4);
  const modules: NonNullable<ShipTemplate['modules']> = d.lay.modules.map((m, i) => {
    const stock = d.stock.get(i);
    return {
      def: m.def, x: m.x, y: m.y, rot: m.rot,
      ...(stock && stock.length > 0 ? { stock } : {}),
      ...(d.vehicles.has(i) ? { vehicle: 'vehicle.shuttle' } : {}),
    };
  });
  return {
    name: `${f.name} ${role.id} ${factionId.replace(/^faction\./, '').slice(0, 2).toUpperCase()}-${tag}`,
    faction: 'hostile',
    doctrine: f.doctrine.targeting,
    crew: plan.crew,
    rows,
    modules,
    ...(f.doctrine.boarding ? { boarding: { ...f.doctrine.boarding } } : {}),
  };
}

/** A container's cargo: the faction's stock list, scaled up by the container's capacity (storage caps what fits). */
function stockOf(rng: Rng, f: FactionDef, def: ModuleDef | undefined): { stock?: { item: string; count: number }[] } {
  const k = Math.ceil((def?.storage?.capacity ?? 0) / 3);
  const stock = f.stock.map((s) => ({ item: s.item, count: rng.int(s.min, s.max) * k })).filter((s) => s.count > 0);
  return stock.length > 0 ? { stock } : {};
}

/** Pick a ship role (weights scaled by depth) and one of its archetypes. */
function pickRole(rng: Rng, f: FactionDef, depth: number): { role: ShipRoleDef; archetype: ArchetypeId } {
  const role = pickWeighted(rng, hullChoices(f, depth)) as ShipRoleDef;
  return { role, archetype: pickWeighted(rng, role.archetypes) };
}

/**
 * The hull family (or ship role) id the first attempt of `seed` builds, without building anything (one draw of the attempt's Rng). A ship
 * whose first attempt fails is built by a later attempt, which may pick another; the galaxy uses this to give a ship a size class cheaply.
 */
export const previewHull = (f: FactionDef, seed: number, depth: number): string =>
  pickWeighted(new Rng(attemptSeed(seed, 0)), hullChoices(f, depth)).id;

/** One generation attempt (attempt `n` of `seed`): the result, or the stage that failed. */
export function generateAttempt(
  f: FactionDef, factionId: string, seed: number, depth: number, defs: Record<string, ModuleDef>, n: number,
): GenResult | string {
  const rng = new Rng(attemptSeed(seed, n));
  let role: ShipRoleDef;
  let archetype: ArchetypeId;
  let plan: ShipPlan;
  let b: Builder;
  let topology: string | null;
  let comp: Arranger | null = null;
  let profile = '';
  if (f.hullFamilies && f.hullFamilies.length > 0) {
    // Assembly-driven: a hull family, its standard sections, composed by constraints.
    const fam = pickWeighted(rng, hullChoices(f, depth)) as HullFamilyDef;
    role = { id: fam.id, weight: fam.weight, archetypes: [], ...(fam.bonus ? { bonus: fam.bonus } : {}), ...(fam.bays ? { bays: fam.bays } : {}) };
    archetype = 'sections';
    plan = planShip(rng, f, role, depth, defs);
    const r = arrangeHull(rng, f, fam, plan, defs);
    if (typeof r === 'string') return `${fam.id}: ${r}`;
    comp = r.A;
    b = r.b;
    plan = r.plan;
    profile = r.profile;
    topology = r.profile;
  } else {
    ({ role, archetype } = pickRole(rng, f, depth));
    plan = planShip(rng, f, role, depth, defs);
    b = new Builder(rng);
    topology = TOPOLOGIES[archetype as Exclude<ArchetypeId, 'sections'>](b, f, plan);
  }
  if (!topology) return `${archetype}: structure clash`;
  return finishLayout(rng, f, factionId, seed, role, archetype, plan, b, topology, comp, profile, defs, n);
}

/** Extra validation of a finished template (stations add their own rules), returning problems. */
export type ExtraCheck = (t: ShipTemplate, defs: Record<string, ModuleDef>) => string[];

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
  const rows = pruneDoors(framed, roomOf, width, roles);
  const byKey = new Map(b.parts.map((p) => [p.key, p.spec]));
  const specs = labels.map((l) => byKey.get(l.chunk) ?? b.chunkSpecs.get(`${l.chunk}:${l.letter}`));
  const d = fitOut(rng, f, rows, roomOf, roles, specs, defs, opts.immobile ? STATION_RECIPES : RECIPES);
  // Airlock-only docks open into the corridor they border (wall and door go; openDocks.ts).
  const opened = d.error ? { merged: 0, walled: 0, tiles: [] } : openBareDocks(d.lay);
  const docks = { merged: opened.merged, walled: opened.walled };
  const dockTile = new Set(opened.tiles);
  const fitted = opened.merged > 0 ? rows.map((r, y) => d.lay.cells.slice(y * d.lay.w, y * d.lay.w + r.length).join('')) : rows;
  const template = toTemplate(f, role, factionId, seed, plan, fitted, d);
  template.modules = [...(template.modules ?? []), ...containers.map((k) => ({ ...k, ...stockOf(rng, f, defs[k.def]) }))];
  const problems = d.error ? [d.error] : validateTemplate(template, defs, opts.immobile ? { immobile: true } : {});
  if (problems.length === 0 && opts.check) problems.push(...opts.check(template, defs));
  const metrics = layoutMetrics(template, (x, y) => roles[roomOf[y * width + x] ?? -1] === 'hall' && !dockTile.has(y * width + x), defs);
  const bad = metricViolation(metrics, f.metrics);
  if (bad && problems.length === 0) problems.push(bad);
  const rooms: GenRoom[] = roles.map((r, id) => ({ id, role: r, tiles: d.lay.roomTiles(id) }));
  return {
    template, rooms, roomOf, width, height, role: role.id, archetype, topology, attempts: n + 1, problems, failures: [], metrics, thin, docks,
    ...(comp ? { debug: comp.debug(ox, oy, width, height, rows, (x, y) => roles[roomOf[y * width + x] ?? -1] === 'hall', profile) } : {}),
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
