import { defineComponent } from '../ecs';

/**
 * 'stowed': inside its home bay (not targetable, not on the sector map). 'flying': in the sector at (x, y). 'docked':
 * latched to an airlock's outer door, at the dock point just outside it.
 */
export type VehicleState = 'stowed' | 'flying' | 'docked';

/** Where a flying vehicle is headed. `bay` is its home bay. */
export type VehicleDest = { type: 'dock'; airlock: number } | { type: 'bay' };

/**
 * A shuttle: an entity, never a grid. It has no tiles; crew who embark are hidden (see AboardC) and listed in `pilot` /
 * `passengers`. Position is in sector tiles.
 */
export interface Vehicle {
  /** VehicleDef content id. */
  def: string;
  /** Grid of the ship it belongs to, and the bay module it is assigned to (0 if the bay is gone). */
  homeGrid: number;
  home: number;
  state: VehicleState;
  x: number;
  y: number;
  /** Direction of the last movement, radians (atan2 of dy, dx in sector space). Renderer-readable. */
  heading: number;
  hp: number;
  /** Crew member flying it, or 0. Required to launch. */
  pilot: number;
  /** Other crew aboard, at most VehicleDef.capacity. */
  passengers: number[];
  dest: VehicleDest | null;
  /** Airlock module it is docked at (state 'docked'), else 0. */
  dock: number;
}
export const VehicleC = defineComponent<Vehicle>('vehicle');

/** On a vehicle bay module: the vehicle assigned to it (stowed or out), or 0. */
export interface VehicleBay {
  vehicle: number;
}
export const VehicleBayC = defineComponent<VehicleBay>('vehicleBay');

/** On crew who ride a vehicle. They have no Position, Path or job: they are not on any grid. */
export interface Aboard {
  vehicle: number;
}
export const AboardC = defineComponent<Aboard>('aboard');

/** On crew walking to a vehicle's boarding tile to climb in; the vehicle system boards them on arrival. */
export interface EmbarkOrder {
  vehicle: number;
}
export const EmbarkOrderC = defineComponent<EmbarkOrder>('embarkOrder');

/**
 * Enemy boarding doctrine state, on a ship entity whose template has `boarding`. 'idle' counts `timer` ticks of combat;
 * 'loading': party walking to the bay; 'sent': shuttle flying; 'landed': party ashore; 'done': nothing more to do.
 */
export interface Boarder {
  party: number;
  afterTicks: number;
  losingBelow: number;
  state: 'idle' | 'loading' | 'sent' | 'landed' | 'done';
  timer: number;
  vehicle: number;
  /** Crew chosen for the party. */
  crew: number[];
}
export const BoarderC = defineComponent<Boarder>('boarder');
