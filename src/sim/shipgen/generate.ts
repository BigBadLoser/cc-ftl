import { Rng } from '../rng';
import type { ModuleDef, ShipTemplate } from '../registry';
import { Builder } from './builder';
import type { Composer } from './compose';
import { composeNavy } from './composeNavy';
import { layoutMetrics, metricViolation } from './metrics';
import { roleOfLetter } from './canvas';
import { lightRoom, placeOne } from './fit';
import { Layout } from './layout';
import { pickWeighted, planShip, scaled, type RoomSpec, type ShipPlan } from './plan';
import { clusters, hub, rails } from './topoDrone';
import { ring, spine } from './topoNavy';
import { salvage } from './topoSalvage';
import { validateTemplate } from './validate';
import type { ArchetypeId, FactionDef, GenResult, GenRoom, RoomRole, ShipRoleDef } from './types';

/** Attempts before giving up on a seed (each reseeds deterministically). */
export const GEN_ATTEMPTS = 24;

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
): Fitted {
  const lay = new Layout(rows, roomOf, roles, defs);
  const out: Fitted = { lay, stock: new Map(), vehicles: new Set() };
  const jobs: { room: number; def: string; spec: RoomSpec }[] = [];
  specs.forEach((spec, room) => { for (const def of spec?.mods ?? []) jobs.push({ room, def, spec: spec as RoomSpec }); });
  jobs.sort((a, b) => rank(a.def, defs[a.def] as ModuleDef) - rank(b.def, defs[b.def] as ModuleDef));
  const placed: Record<string, number> = {};
  const wanted: Record<string, number> = {};
  for (const j of jobs) {
    wanted[j.def] = (wanted[j.def] ?? 0) + 1;
    const pm = placeOne(lay, rng, j.def, [j.room], { spread: !!defs[j.def]?.weapon });
    if (!pm) continue;
    placed[j.def] = (placed[j.def] ?? 0) + 1;
    const idx = lay.modules.length - 1;
    if (j.spec.stock && defs[j.def]?.storage) {
      out.stock.set(idx, f.stock.map((s) => ({ item: s.item, count: rng.int(s.min, s.max) })).filter((s) => s.count > 0));
    }
    if (j.spec.vehicle && defs[j.def]?.vehicleBay) out.vehicles.add(idx);
  }
  const missing = (id: string): boolean => (wanted[id] ?? 0) > 0 && (placed[id] ?? 0) === 0;
  for (const id of ['module.engine', 'module.helm', 'module.airlock', 'module.reactor', 'module.weaponsConsole', 'module.aiCore', 'module.vehicle_bay']) {
    if (missing(id)) return { ...out, error: `no ${id.replace('module.', '')} fits` };
  }
  const guns = (m: Record<string, number>): number => Object.entries(m).filter(([id]) => defs[id]?.weapon).reduce((t, [, n]) => t + n, 0);
  if (guns(placed) === 0 || guns(placed) * 4 < guns(wanted) * 3) return { ...out, error: 'weapons do not fit' };
  if ((placed['module.reactor'] ?? 0) < (wanted['module.reactor'] ?? 0)) return { ...out, error: 'reactors do not fit' };
  for (let room = 0; room < roles.length; room++) lightRoom(lay, rng, room);
  let supply = 0;
  let demand = 0;
  for (const m of lay.modules) { const p = (defs[m.def] as ModuleDef).power; if (p > 0) supply += p; else demand -= p; }
  // Short of power after lighting: squeeze extra reactors into engineering or stores.
  const spare = roles.map((r, i) => (r === 'reactor' || r === 'engine' || r === 'cargo' || r === 'support' ? i : -1)).filter((i) => i >= 0);
  const reactor = defs['module.reactor'];
  for (let k = 0; k < 3 && supply < demand && reactor; k++) {
    if (!placeOne(lay, rng, 'module.reactor', spare)) break;
    supply += reactor.power;
  }
  if (supply < demand) return { ...out, error: 'not enough power' };
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

/** Pick a ship role (weights scaled by depth) and one of its archetypes. */
function pickRole(rng: Rng, f: FactionDef, depth: number): { role: ShipRoleDef; archetype: ArchetypeId } {
  const roles = f.architecture.roles.map((r) => ({ value: r, weight: scaled(r.weight, depth) }));
  const role = pickWeighted(rng, roles.some((r) => r.weight > 0) ? roles : f.architecture.roles.map((r) => ({ value: r, weight: 1 })));
  return { role, archetype: pickWeighted(rng, role.archetypes) };
}

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
  let comp: Composer | null = null;
  let profile = '';
  if (f.hullFamilies && f.hullFamilies.length > 0) {
    // Assembly-driven: a hull family, its standard sections, composed by constraints.
    const fams = f.hullFamilies.map((h) => ({ value: h, weight: scaled(h.weight, depth) }));
    const fam = pickWeighted(rng, fams.some((x) => x.weight > 0) ? fams : fams.map((x) => ({ ...x, weight: 1 })));
    role = { id: fam.id, weight: fam.weight, archetypes: [], ...(fam.bonus ? { bonus: fam.bonus } : {}), ...(fam.bays ? { bays: fam.bays } : {}) };
    archetype = 'sections';
    plan = planShip(rng, f, role, depth, defs);
    const r = composeNavy(rng, f, fam, plan);
    if (!r) return 'sections: no feasible arrangement';
    comp = r.c;
    b = r.c.b;
    profile = r.profile;
    topology = `${r.profile}${r.revisions > 0 ? ` (rev ${r.revisions})` : ''}`;
  } else {
    ({ role, archetype } = pickRole(rng, f, depth));
    plan = planShip(rng, f, role, depth, defs);
    b = new Builder(rng);
    topology = TOPOLOGIES[archetype as Exclude<ArchetypeId, 'sections'>](b, f, plan);
  }
  if (!topology) return `${archetype}: structure clash`;
  b.cv.fixDoors();
  const { rows, labels: roomOf, width, height, ox, oy } = b.cv.crop();
  const labels = b.cv.labels;
  const roles = labels.map((l) => roleOfLetter(l.letter) ?? 'cargo');
  const byKey = new Map(b.parts.map((p) => [p.key, p.spec]));
  const specs = labels.map((l) => byKey.get(l.chunk) ?? b.chunkSpecs.get(`${l.chunk}:${l.letter}`));
  const d = fitOut(rng, f, rows, roomOf, roles, specs, defs);
  const template = toTemplate(f, role, factionId, seed, plan, rows, d);
  const problems = d.error ? [d.error] : validateTemplate(template, defs);
  const metrics = layoutMetrics(template, (x, y) => roles[roomOf[y * width + x] ?? -1] === 'hall', defs);
  const bad = metricViolation(metrics, f.metrics);
  if (bad && problems.length === 0) problems.push(bad);
  const rooms: GenRoom[] = roles.map((r, id) => ({ id, role: r, tiles: d.lay.roomTiles(id) }));
  return {
    template, rooms, roomOf, width, height, role: role.id, archetype, topology, attempts: n + 1, problems, failures: [], metrics,
    ...(comp ? { debug: comp.debug(ox, oy, width, height, roomOf, rows, profile) } : {}),
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
