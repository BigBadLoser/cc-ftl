import { airlockTiles } from '../../modules/airlock';
import { footprintTiles } from '../../modules/footprint';
import { LANDING_PAD } from '../../modules/landingPad';
import type { ModuleDef, ShipTemplate } from '../../registry';
import { Rng } from '../../rng';
import { fitShell, seedOf } from '../shell';
import { SECURITY_ROLE, docksOf, stationCrew } from '../stationCrew';
import type { RoomSpec } from '../plan';
import type { StationDef, StationInfo, StationSize } from '../stationTypes';
import type { FactionDef, GenResult, ShipRoleDef } from '../types';
import { assemble, groundTurrets } from './assemble';
import { PREFAB_PADS } from './prefab';
import { stationProgram } from './program';
import { recipeAt, type Recipe } from './recipe';
import { OUTSIDE } from '../groundTurrets';
import { tubeRows } from '../../tube';

/** Ground round a prefab base's modules and pads, for its turrets (a ring of ground, a turret, a tile to its cable and the hull's). */
const GROUND_MARGIN = 4 + OUTSIDE;

/** What a harbour's customs hall holds: the officers' desk and their two chairs (rules: CU). */
const CUSTOMS: RoomSpec = { role: 'plaza', mods: ['module.mess_table', 'module.chair', 'module.chair'], w: 7, h: 3 };

export interface StationResult extends GenResult {
  station: StationInfo;
  /**
   * A base of separate modules on open ground (a prefab base): an outpost levels the whole site under it, the ground
   * between its modules included, and keeps its landing pads clear (template tiles; each with an airlock facing it).
   */
  site?: { pads: { x: number; y: number; w: number; h: number }[] };
}

/** The FactionDef the shared fit-out reads (stock, crew species, guns and shields); budgets are unused here. */
export function stationFaction(def: StationDef): FactionDef {
  const zero = { base: 0, perDepth: 0, max: 0 };
  return {
    name: def.name, side: def.side, motif: def.motif,
    art: { hull: 'hull.clean', wall: 'wall.clean', roof: 'roof.grid', livery: 'livery.navy', signature: [] },
    architecture: { roles: [], symmetry: 0, corridorWidth: [1, 2], strutLength: [1, 3], battery: 2, noses: [] },
    weapons: def.weapons, shields: def.shields, stock: def.stock,
    living: true, aiCore: true, crew: { required: def.crew.required, pool: def.crew.pool, species: def.crew.species },
    doctrine: { targeting: 'random' },
    budget: { weapons: zero, heavyPct: zero, shields: zero, engines: zero, reactors: zero, pointDefense: zero, crew: zero, crates: zero, size: zero },
  };
}

/** Station rules on top of the ship validators: enough airlock docks, everything inside the template, no engine. */
export function stationProblems(t: ShipTemplate, defs: Record<string, ModuleDef>, minDocks: number): string[] {
  const out: string[] = [];
  const h = t.rows.length;
  const w = Math.max(...t.rows.map((r) => r.length));
  const mods = t.modules ?? [];
  const docks = mods.filter((m) => defs[m.def]?.airlock).length;
  if (docks < minDocks) out.push(`docks: ${docks} < ${minDocks}`);
  for (const m of mods) {
    const def = defs[m.def];
    if (!def) continue;
    const tiles = [...footprintTiles(def, m.x, m.y, m.rot), ...(def.airlock ? ((a) => [a.outer, a.inner, a.inside])(airlockTiles(def, m)) : [])];
    if (tiles.some((p) => p.x < 0 || p.y < 0 || p.x >= w || p.y >= h)) out.push(`${m.def}@${m.x},${m.y}: outside the template`);
  }
  if (mods.some((m) => defs[m.def]?.engine)) out.push('station has an engine');
  return out;
}

const infoOf = (def: StationDef, size: StationSize, t: ShipTemplate, defs: Record<string, ModuleDef>): StationInfo => {
  const mods = t.modules ?? [];
  const n = (p: (d: ModuleDef) => boolean): number => mods.filter((m) => defs[m.def] && p(defs[m.def] as ModuleDef)).length;
  return {
    kind: def.kind, size, crew: (t.crew ?? []).length, security: (t.crew ?? []).filter((r) => r === SECURITY_ROLE).length,
    docks: n((d) => !!d.airlock), guns: n((d) => !!d.weapon), shields: n((d) => !!d.shieldGen),
  };
};

/**
 * A station of `def`'s kind at a size tier, assembled by `recipe` and fitted out: the assembly's regions are the rooms,
 * each with the role and planned contents it was given, and the shared fit-out (`fitShell`) furnishes, validates and
 * measures them. Deterministic from `seed`. The result lists its problems; it throws only when the recipe cannot be
 * assembled at all. The game builds stations through `buildStation`, which picks the recipe and retries.
 */
export function assembleStation(def: StationDef, id: string, size: StationSize, seed: number, defs: Record<string, ModuleDef>, recipe: Recipe): StationResult {
  const rng = new Rng(seedOf(seed, 0));
  const program = stationProgram(rng, def, size, defs);
  const { ok, rejected } = assemble(rng, recipeAt(recipe, size), program);
  if (!ok) throw new Error(`assembleStation: ${recipe.name} does not stand for ${id} ${size} seed ${seed}: ${rejected[rejected.length - 1] ?? 'no reason given'}`);
  const pads = ok.pads ?? [];
  // A prefab base's pads are open ground inside its extent.
  const reach = pads.length > 0 ? ([Math.min(...pads.map((p) => p[0])), Math.min(...pads.map((p) => p[1])), Math.max(...pads.map((p) => p[2])), Math.max(...pads.map((p) => p[3]))] as const) : undefined;
  const prefab = ok.recipe.root.kind === 'prefab';
  const g = ok.ctx.g, cell = g.compile(), first = g.snapshot(cell, reach);
  // A prefab base's turrets stand on the ground round it: its site reaches GROUND_MARGIN tiles past its modules and pads.
  const M = prefab ? GROUND_MARGIN : 0;
  const snap = M > 0 ? g.snapshot(cell, [first.x0 - M, first.y0 - M, first.x0 + first.width + M, first.y0 + first.height + M]) : first;
  // A hatch in the outer wall is the airlock's own door: the fit-out stands an airlock module in plain hull.
  const at = (x: number, y: number): string => snap.rows[y]?.[x] ?? '.';
  const rows = snap.rows.map((row, y) => [...row].map((c, x) => (c === 'D' && [at(x + 1, y), at(x - 1, y), at(x, y + 1), at(x, y - 1)].includes('.') ? '#' : c)).join(''));
  const role: ShipRoleDef = { id: size, weight: { base: 1, perDepth: 0, max: 1 }, archetypes: [] };
  const made = fitShell(
    rng, stationFaction(def), id, seed, role, 'sections', { crew: stationCrew(rng, def, size) },
    { rows, roomOf: snap.roomOf, width: snap.width, height: snap.height, roles: g.regions.map((r) => r.role), specs: g.regions.map((r) => r.spec ?? (r.dept === 'customs' ? CUSTOMS : undefined)) },
    `assembly ${recipe.name}`, defs, 0, { immobile: true, ...(g.entries.size > 0 ? { entries: g.entries } : {}), ...(prefab ? { ground: { mods: groundTurrets(ok.recipe, program, defs), keep: pads.map((p) => [p[0] - snap.x0, p[1] - snap.y0, p[2] - snap.x0, p[3] - snap.y0] as const), pads: pads.map((p, i) => ({ def: LANDING_PAD, box: [p[0] - snap.x0, p[1] - snap.y0, p[2] - snap.x0, p[3] - snap.y0] as const, ...(i === 0 ? { vehicle: 'vehicle.shuttle' } : {}) })), seed, ...(g.apartModules.length > 0 ? { apart: g.apartModules } : {}) } } : {}), check: (t, d) => stationProblems(t, d, prefab ? Math.min(PREFAB_PADS, docksOf(def, size)) : docksOf(def, size)) },
  );
  // The crew's airlocks (a prefab base's wing and greenhouses) are no docks for ships.
  if (g.crewLocks.size > 0) made.template.modules = (made.template.modules ?? []).map((m) => (defs[m.def]?.airlock && footprintTiles(defs[m.def] as ModuleDef, m.x, m.y, m.rot).some((t) => g.crewLocks.has(snap.roomOf[t.y * snap.width + t.x] ?? -1)) ? { ...m, crew: true as const } : m));
  // An asteroid farm's beds are set to the kind's crops, in turn: its crew farm them out of the box.
  const crops = prefab ? def.crops ?? [] : [];
  if (crops.length > 0) {
    const mods = made.template.modules ?? [], beds = mods.filter((m) => defs[m.def]?.plot);
    made.template.modules = mods.map((m) => { const k = beds.indexOf(m), crop = k >= 0 ? crops[k % crops.length] : undefined; return crop ? { ...m, crop } : m; });
  }
  made.template.name = `${def.name} ${size === 'station' ? '' : `${size} `}${(seed >>> 0).toString(16).toUpperCase().padStart(4, '0').slice(-4)}`;
  // A prefab base's tubes: their floor tiles, drawn as glass tubes (tube.ts).
  if (g.tubes.length > 0) made.template.tubes = tubeRows(snap.width, snap.height, new Set(g.tubes.map(([x, y]) => (y - snap.y0) * snap.width + (x - snap.x0))));
  const site = { pads: pads.map((p) => ({ x: p[0] - snap.x0, y: p[1] - snap.y0, w: p[2] - p[0], h: p[3] - p[1] })) };
  return { ...made, failures: rejected, station: infoOf(def, size, made.template, defs), ...(prefab ? { site } : {}) };
}
