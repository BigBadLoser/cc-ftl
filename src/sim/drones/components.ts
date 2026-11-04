import { defineComponent } from '../ecs';
import type { DroneJobKind } from './types';

/**
 * What a drone is working on: a module (`id`, repair), a crew member (`id`, first aid) or a burning tile (`x`, `y`, extinguish). One drone
 * per target (the claim rule): another drone skips a target that one already holds. `x`, `y` is where it hovers to work.
 */
export interface DroneTarget {
  kind: DroneJobKind;
  id: number;
  x: number;
  y: number;
}

/**
 * 'docked': in its bay slot, charging. 'out': flying to its target or working on it (working once `steps` is empty). 'home': flying back to
 * its bay. Knocked out (no live core: `inert`; ion: `stunUntil`) it drops to the deck wherever it is and does nothing.
 */
export type DroneState = 'docked' | 'out' | 'home';

/**
 * A drone (DESIGN.md "Drones"): its own entity on a free body (BodyC: sector tiles, a tile's centre at +0.5), run by the drone system and
 * the ship's AI core. Never crew: no jobs, priorities or orders.
 */
export interface Drone {
  /** DroneDef content id. */
  def: string;
  /** Home ship (ShipC entity): its AI core runs the drone. */
  ship: number;
  /** Home drone bay (module entity) and the slot in it, or 0 when the bay is gone (it docks in any free slot on its ship). */
  bay: number;
  slot: number;
  state: DroneState;
  /** Battery 0..100. */
  charge: number;
  hp: number;
  target: DroneTarget | null;
  /** Tiles still to fly through (sector tiles), last one the goal. */
  steps: { x: number; y: number }[];
  /** Seconds of work on the current target (a patch). */
  work: number;
  /** No live AI core: dropped and idle until the core is back. */
  inert: boolean;
  /** Knocked out by ion or EMP until this tick (0 = not). */
  stunUntil: number;
}
export const DroneC = defineComponent<Drone>('drone');
