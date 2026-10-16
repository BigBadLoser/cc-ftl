import type { Grid } from '../grid';
import type { Sim } from '../sim';
import { isWalkable } from '../structure';
import { ModuleC } from './components';

/** True if the module entity is a solid one (blocks walking). Unknown ids are not solid. */
export function isSolidModule(sim: Sim, id: number): boolean {
  const m = sim.world.get(id, ModuleC);
  return m ? (sim.content.modules[m.def]?.solid ?? false) : false;
}

/** Crew can stand here: walkable struct and no solid module. The one walkability rule for pathing. */
export function isTileWalkable(sim: Sim, grid: Grid, x: number, y: number): boolean {
  if (!grid.inBounds(x, y) || !isWalkable(grid.get('struct', x, y))) return false;
  if (!grid.has('module')) return true;
  const id = grid.get('module', x, y);
  return id === 0 || !isSolidModule(sim, id);
}
