import { hullArea, templateHullArea } from '../combat/hull';
import { ModuleC } from '../modules/components';
import type { ModuleDef, ShipTemplate } from '../registry';
import { shipGrid, shipIdOf } from '../regions';
import type { Sim } from '../sim';

/**
 * A ship's hull against what its engines can push. Every ship obeys it: the player's (`jump`), and the generated ones, which shipgen gives
 * engines enough for their hull (`templateHullLoad`), so a captured prize starts within it too.
 */
export interface HullLoad {
  /** The ship's size: every tile its outer hull encloses (`hullArea`, also the jobs screen's count). */
  tiles: number;
  /** The sum of `engine.hullCapacity` over the ship's engines that still work (hp above 0). */
  capacity: number;
  /** Engine modules the ship has, destroyed ones included. A ship with none (a fixture, a station) has no limit. */
  engines: number;
  /** Tiles over capacity (0 when it fits, or when the ship has no engines at all). */
  over: number;
  /** tiles / capacity, or 0 when there is no capacity to compare against and no hull either. */
  ratio: number;
}

const capacityIn = (defs: Readonly<Record<string, ModuleDef>>, def: string): number => defs[def]?.engine?.hullCapacity ?? 0;

/** The capacity of one engine module def (0 for anything else). */
export const engineCapacityOf = (sim: Sim, def: string): number => capacityIn(sim.content.modules, def);

/** A hull of `tiles` against `engines` engine modules whose working ones carry `capacity` in all. */
function loadOf(tiles: number, capacity: number, engines: number): HullLoad {
  const over = engines > 0 ? Math.max(0, tiles - capacity) : 0;
  return { tiles, capacity, engines, over, ratio: capacity > 0 ? tiles / capacity : tiles > 0 ? Infinity : 0 };
}

/** Size of a ship against its engines' capacity. Destroyed engines (0 hp) carry nothing. */
export function hullLoad(sim: Sim, ship: number): HullLoad {
  const grid = shipGrid(sim, ship);
  const tiles = grid?.has('struct') ? hullArea(grid) : 0;
  let capacity = 0;
  let engines = 0;
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    if (!m || !sim.content.modules[m.def]?.engine || shipIdOf(sim, m) !== ship) continue;
    engines++;
    if (m.hp > 0) capacity += engineCapacityOf(sim, m.def);
  }
  return loadOf(tiles, capacity, engines);
}

/**
 * The same measure for a ship template, before the ship exists: `templateHullArea` against its engines, all working. The ship generator
 * checks its hulls by it, so a generated ship spawns within `hullLoad`.
 */
export function templateHullLoad(defs: Readonly<Record<string, ModuleDef>>, t: Pick<ShipTemplate, 'rows' | 'modules'>): HullLoad {
  let capacity = 0;
  let engines = 0;
  for (const m of t.modules ?? []) {
    if (!defs[m.def]?.engine) continue;
    engines++;
    capacity += capacityIn(defs, m.def);
  }
  return loadOf(templateHullArea(t.rows), capacity, engines);
}
