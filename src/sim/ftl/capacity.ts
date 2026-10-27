import { hullTiles } from '../combat/hull';
import { ModuleC } from '../modules/components';
import { shipGrid, shipIdOf } from '../regions';
import type { Sim } from '../sim';

/**
 * A ship's hull against what its engines can push.
 * TODO(#129): only the player's ship obeys engine capacity (`jump` is the player's). NPC ships should obey it too once shipgen gives big
 * hulls enough engines; today a generated one-engine liner is far over any sensible per-engine number.
 */
export interface HullLoad {
  /** Hull tiles: the outer hull profile (`hullTiles`, also the jobs screen's count). */
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

/** The capacity of one engine module def (0 for anything else). */
export const engineCapacityOf = (sim: Sim, def: string): number => sim.content.modules[def]?.engine?.hullCapacity ?? 0;

/** Hull tiles of a ship against its engines' capacity. Destroyed engines (0 hp) carry nothing. */
export function hullLoad(sim: Sim, ship: number): HullLoad {
  const grid = shipGrid(sim, ship);
  const tiles = grid?.has('struct') ? hullTiles(grid) : 0;
  let capacity = 0;
  let engines = 0;
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    if (!m || !sim.content.modules[m.def]?.engine || shipIdOf(sim, m) !== ship) continue;
    engines++;
    if (m.hp > 0) capacity += engineCapacityOf(sim, m.def);
  }
  const over = engines > 0 ? Math.max(0, tiles - capacity) : 0;
  return { tiles, capacity, engines, over, ratio: capacity > 0 ? tiles / capacity : tiles > 0 ? Infinity : 0 };
}
