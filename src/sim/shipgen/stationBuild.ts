import type { ModuleDef } from '../registry';
import { Rng } from '../rng';
import { assembleStation, type StationResult } from './assembly/station';
import type { Recipe } from './assembly/recipe';
import type { StationDef, StationSize } from './stationTypes';

/**
 * Seeds tried with the kind's recipes before a station gives up: far more than any kind needs (a sweep of every kind
 * and size over seeds 1 to 24 stood on the first try but for two pirate stations, which stood on the second).
 */
export const STATION_TRIES = 8;

/**
 * A station of `def`'s kind at a size tier: the one way the game builds one. The seed picks one of the kind's families
 * (`def.assembly`, its looks), then a recipe in it, and the station is assembled; one that does not stand or has
 * problems is tried again on the next seeds (the result's `attempts` counts the tries). `families` overrides the
 * kind's (an asteroid outpost's, `def.outpostAssembly`). Deterministic from `seed`. Throws when no seed stands: a kind's
 * recipes are expected to stand at every size on every seed, and the station sweep tests hold them to it.
 */
export function buildStation(
  def: StationDef, id: string, size: StationSize, seed: number, defs: Record<string, ModuleDef>, families: readonly (readonly Recipe[])[] = def.assembly,
): StationResult {
  const why: string[] = [];
  for (let k = 0; k < STATION_TRIES; k++) {
    const s = (seed + k * 104729) >>> 0;
    const rng = new Rng(s ^ 0x5a7e1105);
    const family: readonly Recipe[] = families.length > 0 ? rng.pick([...families]) : [];
    const recipe = family.length > 0 ? rng.pick([...family]) : null;
    if (!recipe) { why.push('no recipes'); continue; }
    try {
      const r = assembleStation(def, id, size, s, defs, recipe);
      if (r.problems.length === 0) return { ...r, attempts: k + 1 };
      why.push(`${recipe.name}: ${r.problems[0] ?? ''}`);
    } catch (e) {
      why.push(e instanceof Error ? e.message : String(e));
    }
  }
  throw new Error(`buildStation: no ${id} ${size} stands on seed ${seed} after ${STATION_TRIES} tries (${why.slice(0, 3).join('; ')})`);
}
