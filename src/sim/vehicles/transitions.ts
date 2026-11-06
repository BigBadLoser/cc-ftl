import { ALT, BodyC } from '../body';
import { ModuleC } from '../modules/components';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import type { Vehicle } from './components';

/**
 * Where a vehicle's state changes are reported (`vehicle.launched`, `.docked`, `.stowed`; `.undocked` is `undock` in lifecycle.ts).
 * Every path that puts a vehicle into space, docks it or stows it goes through these, so each change has one emit point.
 */

/** A vehicle just entered space (it may already be flying, as a freshly created shuttle is): report it launched from where its body is. */
export function reportLaunched(sim: Sim, id: number, v: Vehicle): void {
  const b = sim.world.get(id, BodyC);
  sim.events.emit({ type: 'vehicle.launched', vehicle: id, ship: v.homeShip, x: b?.x ?? 0, y: b?.y ?? 0 });
}

/** A stowed vehicle leaves its bay: flying, no destination, reported launched. */
export function launchVehicle(sim: Sim, id: number, v: Vehicle): void {
  v.state = 'flying';
  v.dest = null;
  reportLaunched(sim, id, v);
}

/** A flying vehicle latches on to `airlock`. */
export function dockVehicle(sim: Sim, id: number, v: Vehicle, airlock: number): void {
  v.state = 'docked';
  v.dock = airlock;
  const b = sim.world.get(id, BodyC);
  if (b) b.alt = ALT.docked;
  sim.events.emit({ type: 'vehicle.docked', vehicle: id, ship: shipIdOf(sim, sim.world.get(airlock, ModuleC)), airlock });
}

/** A flying vehicle flies into its home bay. */
export function stowVehicle(sim: Sim, id: number, v: Vehicle): void {
  v.state = 'stowed';
  const b = sim.world.get(id, BodyC);
  if (b) b.alt = ALT.stowed;
  sim.events.emit({ type: 'vehicle.stowed', vehicle: id, bay: v.home });
}
