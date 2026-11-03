import { EggSacC, NestC } from '../aliens/components';
import { ShipC } from '../combat/components';
import { CrewC, DeadC, JobC, PositionC } from '../crew/components';
import { ItemStackC } from '../items/components';
import { destroyJob } from '../items/stacks';
import { SalvageWatchC, TransferC } from '../logistics/components';
import { ModuleC } from '../modules/components';
import { removeModule } from '../modules/spawn';
import { shipGrid, shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { Struct, writeStruct } from '../structure';
import { SPACE_TEMP } from '../tuning';
import { VehicleC } from '../vehicles/components';

/** True when the ship has no structure and no module left (every tile it owned is open space). */
export function isEmptyShell(sim: Sim, ship: number): boolean {
  const grid = shipGrid(sim, ship);
  if (!grid) return true;
  for (const id of sim.world.query(ModuleC)) if (shipIdOf(sim, sim.world.get(id, ModuleC)) === ship) return false;
  for (let y = grid.y0; y < grid.y0 + grid.height; y++) {
    for (let x = grid.x0; x < grid.x0 + grid.width; x++) if (grid.get('ship', x, y) === ship && grid.get('struct', x, y) !== Struct.Space) return false;
  }
  return true;
}

/**
 * Take a ship out of the world: its jobs, modules, loose stacks, corpses, egg sacs and nests go, every tile it owns becomes open space with
 * no owner, and then the ShipC entity itself (which carries its salvage order and watch). Living crew are left where they stand (the
 * caller makes sure nobody is aboard), shuttles holding station beside it are released, and queued transfers from it are dropped.
 */
export function removeWreck(sim: Sim, ship: number): void {
  const grid = shipGrid(sim, ship);
  if (!grid || !sim.world.has(ship, ShipC)) return;
  const here = (at: { x: number; y: number } | undefined): boolean => shipIdOf(sim, at) === ship;
  for (const id of [...sim.world.query(JobC)]) if (here(sim.world.get(id, JobC))) destroyJob(sim, id);
  for (const id of [...sim.world.query(ModuleC)]) if (here(sim.world.get(id, ModuleC))) removeModule(sim, id);
  for (const id of [...sim.world.query(ItemStackC)]) if (here(sim.world.get(id, ItemStackC))) sim.world.destroyEntity(id);
  for (const id of [...sim.world.query(CrewC, PositionC, DeadC)]) if (here(sim.world.get(id, PositionC))) sim.world.destroyEntity(id);
  for (const id of [...sim.world.query(EggSacC)]) if (sim.world.get(id, EggSacC)?.ship === ship) sim.world.destroyEntity(id);
  for (const id of [...sim.world.query(NestC)]) if (sim.world.get(id, NestC)?.ship === ship) sim.world.destroyEntity(id);
  for (const id of [...sim.world.query(TransferC)]) if (sim.world.get(id, TransferC)?.from === ship) sim.world.destroyEntity(id);
  for (const id of sim.world.query(VehicleC)) {
    const v = sim.world.get(id, VehicleC);
    if (!v) continue;
    if (v.dest?.type === 'hover' && v.dest.ship === ship) v.dest = null;
    if (v.hover === ship) v.hover = 0;
  }
  for (let y = grid.y0; y < grid.y0 + grid.height; y++) {
    for (let x = grid.x0; x < grid.x0 + grid.width; x++) {
      if (grid.get('ship', x, y) !== ship) continue;
      if (grid.has('module')) grid.set('module', x, y, 0);
      if (grid.has('item')) grid.set('item', x, y, 0);
      writeStruct(grid, x, y, Struct.Space); // clears the owner too
      grid.set('o2', x, y, 0);
      grid.set('co2', x, y, 0);
      grid.set('temp', x, y, SPACE_TEMP);
      grid.set('fire', x, y, 0);
      grid.set('smoke', x, y, 0);
    }
  }
  sim.world.remove(ship, SalvageWatchC);
  sim.world.destroyEntity(ship);
}
