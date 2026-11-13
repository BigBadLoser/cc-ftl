import type { ModuleDef } from '../../registry';
import { Rng } from '../../rng';
import { fitShell, seedOf } from '../generate';
import { infoOf, stationFaction, stationProblems, type StationResult } from '../stationGen';
import { stationCrew } from '../stationPlan';
import type { StationDef, StationSize } from '../stationTypes';
import type { HullFamilyDef, ShipRoleDef } from '../types';
import { assemble } from './assemble';
import { docksOf, stationProgram } from './program';
import { recipeAt, type Recipe } from './recipe';

/**
 * A station of `def`'s kind at a size tier, assembled by `recipe` and fitted out as the station grammars' structures
 * are: the assembly's regions are the rooms, each with the role and planned contents it was given, and the shared
 * fit-out (`fitShell`) furnishes, validates and measures them. Deterministic from `seed`. The result lists its
 * problems; it throws only when the recipe cannot be assembled at all.
 */
export function assembleStation(def: StationDef, id: string, size: StationSize, seed: number, defs: Record<string, ModuleDef>, recipe: Recipe): StationResult {
  const rng = new Rng(seedOf(seed, 0));
  const { ok, rejected } = assemble(rng, recipeAt(recipe, size), stationProgram(rng, def, size, defs));
  if (!ok) throw new Error(`assembleStation: ${recipe.name} does not stand for ${id} ${size} seed ${seed}: ${rejected[rejected.length - 1] ?? 'no reason given'}`);
  const g = ok.ctx.g, snap = g.snapshot();
  // A hatch in the outer wall is the airlock's own door: the fit-out stands an airlock module in plain hull.
  const at = (x: number, y: number): string => snap.rows[y]?.[x] ?? '.';
  const rows = snap.rows.map((row, y) => [...row].map((c, x) => (c === 'D' && [at(x + 1, y), at(x - 1, y), at(x, y + 1), at(x, y - 1)].includes('.') ? '#' : c)).join(''));
  const f = stationFaction(def, size);
  const role: ShipRoleDef = { id: size, weight: ((f.hullFamilies as HullFamilyDef[])[0] as HullFamilyDef).weight, archetypes: [] };
  const made = fitShell(
    rng, f, id, seed, role, 'sections', { crew: stationCrew(rng, def, size) },
    { rows, roomOf: snap.roomOf, width: snap.width, height: snap.height, roles: g.regions.map((r) => r.role), specs: g.regions.map((r) => r.spec) },
    `assembly ${recipe.name}`, defs, 0, { immobile: true, airlocksAnyWay: true, gunsAnywhere: true, check: (t, d) => stationProblems(t, d, docksOf(def, size)) },
  );
  made.template.name = `${def.name} ${size === 'station' ? '' : `${size} `}${(seed >>> 0).toString(16).toUpperCase().padStart(4, '0').slice(-4)}`;
  return { ...made, failures: rejected, station: infoOf(def, size, made.template, defs) };
}
