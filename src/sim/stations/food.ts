import { storagesOn } from '../combat/ammo';
import { CrewC } from '../crew/components';
import { hungerDrainPerSec } from '../crew/eating';
import { StorageC } from '../items/components';
import { storageAdd } from '../items/storage';
import type { Sim } from '../sim';
import { StationCrewC } from './components';

/** The food a station's supply run brings: the emergency ration, the same food a galley prints from water. */
export const STATION_FOOD = 'item.ration';
/** Rations held per hungry crew member after a restock: a ration is 50 of 100 hunger at 0.12 per second, so 8 is about an hour of eating. */
export const FOOD_PER_CREW = 8;
/** Ticks between supply runs (2 minutes at 20 ticks per second). */
export const FOOD_EVERY = 2400;

/** Food units (any item with `food`) held in a ship's storage. */
function foodHeld(sim: Sim, ship: number): number {
  let n = 0;
  for (const id of storagesOn(sim, ship)) {
    for (const st of sim.world.get(id, StorageC)?.stacks ?? []) if (sim.content.items[st.item]?.food) n += st.count;
  }
  return n;
}

/**
 * Stock a station's larders to its crew: top the ship's food up to `FOOD_PER_CREW` rations per hungry crew member, into the first
 * storage with room. Called when the station is stamped (a fresh station has been running long before anyone arrives) and by the
 * director every `FOOD_EVERY` ticks, so a station's supply ships keep its people fed. Crew-less stations and kinds without a ration
 * item are left alone. Returns the units added. Deterministic: no rolls, storages in id order.
 */
export function stockStationFood(sim: Sim, station: number): number {
  if (!sim.content.items[STATION_FOOD]) return 0;
  let crew = 0;
  for (const c of sim.world.query(StationCrewC, CrewC)) {
    if (sim.world.get(c, StationCrewC)?.station === station && hungerDrainPerSec(sim, c, false) > 0) crew++;
  }
  let need = crew * FOOD_PER_CREW - foodHeld(sim, station);
  const given = Math.max(0, need);
  for (const id of [...storagesOn(sim, station)].sort((a, b) => a - b)) {
    if (need <= 0) break;
    need -= storageAdd(sim, id, STATION_FOOD, need);
  }
  return given - Math.max(0, need);
}
