import { BodyC } from '../body';
import { shipById } from '../combat/ships';
import type { Sim } from '../sim';
import { VehicleC, type VehicleState } from './components';
import { vehicleDefOf } from './lifecycle';

/** Plain, read-only snapshot of a vehicle for the renderer and UI. */
export interface VehicleView {
  id: number;
  def: string;
  asset: string;
  state: VehicleState;
  /** Its body: sector position (tiles), heading (radians) and altitude (tiles). Stowed vehicles sit at their bay's centre. */
  x: number;
  y: number;
  heading: number;
  alt: number;
  hp: number;
  maxHp: number;
  /** ShipC entity of its home ship, and that ship's grid (kept for the UI's grid-keyed snapshots until step 7). */
  homeShip: number;
  homeGrid: number;
  /** Module id of the bay, or of the airlock it is docked at / flying to (0 = none). */
  bay: number;
  dockedAt: number;
  destination: 'dock' | 'bay' | 'hover' | null;
  /** Ship (ShipC entity) it hovers beside, and that ship's grid (0 = none). */
  hovering: number;
  hoveringGrid: number;
  pilot: number;
  passengers: readonly number[];
}

/** Every vehicle, ascending id. */
export function vehicleViews(sim: Sim): VehicleView[] {
  const out: VehicleView[] = [];
  for (const id of sim.world.query(VehicleC, BodyC)) {
    const v = sim.world.get(id, VehicleC);
    const b = sim.world.get(id, BodyC);
    if (!v || !b) continue;
    const hovering = shipById(sim, v.hover ?? 0) ? (v.hover as number) : 0;
    out.push({
      id, def: v.def, asset: vehicleDefOf(sim, v)?.asset ?? '', state: v.state, x: b.x, y: b.y, heading: b.heading, alt: b.alt, hp: v.hp,
      maxHp: vehicleDefOf(sim, v)?.maxHp ?? v.hp, homeShip: v.homeShip, homeGrid: v.homeShip, bay: v.home, dockedAt: v.dock,
      destination: v.dest?.type ?? null, pilot: v.pilot, passengers: v.passengers, hovering, hoveringGrid: hovering,
    });
  }
  return out;
}

/** Vehicles out of their bays (flying or docked): the ones visible in the sector and targetable. */
export function vehiclesInSector(sim: Sim): VehicleView[] {
  return vehicleViews(sim).filter((v) => v.state !== 'stowed');
}
