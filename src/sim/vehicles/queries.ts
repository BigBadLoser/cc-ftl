import type { Sim } from '../sim';
import { VehicleC, type VehicleState } from './components';
import { vehicleDefOf } from './lifecycle';

/** Plain, read-only snapshot of a vehicle for the renderer and UI. */
export interface VehicleView {
  id: number;
  def: string;
  asset: string;
  state: VehicleState;
  /** Sector position (tiles) and heading (radians). Stowed vehicles sit at their bay's centre. */
  x: number;
  y: number;
  heading: number;
  hp: number;
  maxHp: number;
  homeGrid: number;
  /** Module id of the bay, or of the airlock it is docked at / flying to (0 = none). */
  bay: number;
  dockedAt: number;
  destination: 'dock' | 'bay' | null;
  pilot: number;
  passengers: readonly number[];
}

/** Every vehicle, ascending id. */
export function vehicleViews(sim: Sim): VehicleView[] {
  const out: VehicleView[] = [];
  for (const id of sim.world.query(VehicleC)) {
    const v = sim.world.get(id, VehicleC);
    if (!v) continue;
    out.push({
      id, def: v.def, asset: vehicleDefOf(sim, v)?.asset ?? '', state: v.state, x: v.x, y: v.y, heading: v.heading, hp: v.hp,
      maxHp: vehicleDefOf(sim, v)?.maxHp ?? v.hp, homeGrid: v.homeGrid, bay: v.home, dockedAt: v.dock,
      destination: v.dest?.type ?? null, pilot: v.pilot, passengers: v.passengers,
    });
  }
  return out;
}

/** Vehicles out of their bays (flying or docked): the ones visible in the sector and targetable. */
export function vehiclesInSector(sim: Sim): VehicleView[] {
  return vehicleViews(sim).filter((v) => v.state !== 'stowed');
}
