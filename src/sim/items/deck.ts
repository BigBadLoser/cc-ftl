import { ModuleC } from '../modules/components';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { StorageC } from './components';
import { spillItems } from './stacks';
import { storageAdd } from './storage';

/** The module of a ship goods are set down beside: its first storage module, else its first module of any kind. Undefined for a ship with none. */
export function deckSpot(sim: Sim, ship: number): { x: number; y: number } | undefined {
  const mods = sim.world.query(ModuleC).filter((id) => shipIdOf(sim, sim.world.get(id, ModuleC)) === ship).sort((a, b) => a - b);
  const id = mods.find((m) => sim.world.has(m, StorageC)) ?? mods[0];
  return id === undefined ? undefined : sim.world.get(id, ModuleC);
}

/**
 * Put goods aboard a ship: into its storage modules, the rest on the deck beside `deckSpot`. Returns the units that found no room anywhere (the
 * caller decides what that means: it is never silently lost here).
 */
export function stowOrDrop(sim: Sim, ship: number, item: string, count: number): number {
  let left = count;
  const stores = sim.world.query(StorageC, ModuleC).filter((id) => shipIdOf(sim, sim.world.get(id, ModuleC)) === ship).sort((a, b) => a - b);
  for (const id of stores) left -= storageAdd(sim, id, item, left);
  const at = left > 0 ? deckSpot(sim, ship) : undefined;
  return at ? spillItems(sim, ship, at.x, at.y, item, left) : left;
}
