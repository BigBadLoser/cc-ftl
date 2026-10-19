import type { Grid } from '../grid';
import type { Sim } from '../sim';
import { isEvaWalkable, isWalkable } from '../structure';
import { ModuleC } from './components';
import { openTilesOf } from './footprint';

/** True if the module entity is a solid one (blocks walking). Unknown ids are not solid. */
export function isSolidModule(sim: Sim, id: number): boolean {
  const m = sim.world.get(id, ModuleC);
  return m ? (sim.content.modules[m.def]?.solid ?? false) : false;
}

/** Walk info of a module: solid, and the world tiles (keyed y * OPEN_KEY + x) of it that stay walkable. */
export interface WalkInfo {
  solid: boolean;
  open: Set<number>;
}
export const OPEN_KEY = 4096;

export function walkInfo(sim: Sim, id: number): WalkInfo {
  const m = sim.world.get(id, ModuleC);
  const def = m && sim.content.modules[m.def];
  if (!m || !def) return { solid: false, open: new Set() };
  return { solid: def.solid, open: new Set(openTilesOf(def, m.x, m.y, m.rot).map((t) => t.y * OPEN_KEY + t.x)) };
}

/**
 * Crew can stand here: walkable struct and no solid module. The one walkability rule for pathing. `suited`: the walker
 * wears a spacesuit, so exterior surfaces (isEvaWalkable) count too.
 */
export function isTileWalkable(sim: Sim, grid: Grid, x: number, y: number, suited = false): boolean {
  if (!grid.inBounds(x, y)) return false;
  const kind = grid.get('struct', x, y);
  if (!isWalkable(kind) && !(suited && isEvaWalkable(kind))) return false;
  if (!grid.has('module')) return true;
  const id = grid.get('module', x, y);
  if (id === 0) return true;
  const m = sim.world.get(id, ModuleC);
  const def = m && sim.content.modules[m.def];
  if (!m || !def?.solid) return true;
  return openTilesOf(def, m.x, m.y, m.rot).some((t) => t.x === x && t.y === y);
}
