import type { ModuleDef } from '../registry';
import { Rng } from '../rng';
import { assembleStation } from './assembly/station';
import type { Recipe } from './assembly/recipe';
import { generateStation, type StationResult } from './stationGen';
import type { StationDef, StationSize } from './stationTypes';

/** Seeds tried with the kind's recipes before a station falls back to the station grammars. */
const TRIES = 3;

/**
 * A station of `def`'s kind at a size tier: the one way the game builds one. With the kind's assembly recipes
 * (`def.assembly`), the seed picks a family, then a recipe in it, and the station is assembled; one that does not
 * stand or has problems is tried again on the next seeds. With none, or when no seed stands, the station grammars
 * build it (`generateStation`), until every kind's recipes stand everywhere. `families` overrides the kind's (an asteroid
 * outpost's, `def.outpostAssembly`). Deterministic from `seed`.
 */
export function buildStation(
  def: StationDef, id: string, size: StationSize, seed: number, defs: Record<string, ModuleDef>, families: readonly (readonly Recipe[])[] = def.assembly ?? [],
): StationResult {
  for (let k = 0; k < TRIES && families.length > 0; k++) {
    const s = (seed + k * 104729) >>> 0;
    const rng = new Rng(s ^ 0x5a7e1105);
    const family: readonly Recipe[] = rng.pick([...families]);
    if (family.length === 0) continue;
    const recipe = rng.pick([...family]);
    try {
      const r = assembleStation(def, id, size, s, defs, recipe);
      if (r.problems.length === 0) return r;
    } catch {
      // Did not stand on this seed: the next one.
    }
  }
  return generateStation(def, id, size, seed, defs);
}
