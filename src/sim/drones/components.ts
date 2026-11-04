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
 * 'docked': in its bay slot, charging. 'launch': going up through the bay's ceiling hatch into space. 'out': flying to its target or working
 * on it (inside, working once `steps` is empty; in space the job steers it). 'home': flying back to its bay. 'land': coming down through the
 * hatch onto its pad. Knocked out (no live core: `inert`; ion: `stunUntil`) it drops to the deck wherever it is (in space it drifts) and does
 * nothing.
 */
export type DroneState = 'docked' | 'launch' | 'out' | 'home' | 'land';

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
  /** Out in space (free flight on its body) rather than inside its ship. Launch and land move it between the two. */
  space: boolean;
  /** Progress 0..1 through a launch or a landing. */
  lift: number;
  /** Ticks until its gun is ready again (defence); it was just fired while this is near its full reload (render: the firing pose). */
  cool: number;
  /** Recalled and cleared to land: it has left its place in the queue and is on its way to the hatch (drones/run.ts, staggered return). */
  clear?: boolean;
  /** Units of its def's supply item it carries now (absent: none). */
  load?: number;
}
export const DroneC = defineComponent<Drone>('drone');
