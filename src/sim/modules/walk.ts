import type { Grid } from '../grid';
import type { Sim } from '../sim';
import { isWalkable } from '../structure';
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

/** Crew can stand here: walkable struct and no solid module. The one walkability rule for pathing. */
export function isTileWalkable(sim: Sim, grid: Grid, x: number, y: number): boolean {
  if (!grid.inBounds(x, y) || !isWalkable(grid.get('struct', x, y))) return false;
  if (!grid.has('module')) return true;
  const id = grid.get('module', x, y);
  if (id === 0) return true;
  const info = walkInfo(sim, id);
  return !info.solid || info.open.has(y * OPEN_KEY + x);
}
