import { defineComponent } from '../ecs';
import type { ItemQty } from '../registry';

/**
 * 'stowed': inside its home bay (not targetable, not on the sector map). 'flying': free in the sector (its BodyC). 'docked':
 * latched to an airlock's outer door, at the dock point just outside it.
 */
export type VehicleState = 'stowed' | 'flying' | 'docked';

/** Where a flying vehicle is headed. `bay` is its home bay. */
export type VehicleDest = { type: 'dock'; airlock: number } | { type: 'bay' } | { type: 'hover'; ship: number };

/**
 * A shuttle: an entity, never a grid. It has no tiles; crew who embark are hidden (see AboardC) and listed in `pilot` /
 * `passengers`. Its position, heading and altitude are its BodyC (sector tiles); this holds the state machine.
 */
export interface Vehicle {
  /** VehicleDef content id. */
  def: string;
  /** The ShipC entity of the ship it belongs to, and the bay module it is assigned to (0 if the bay is gone). */
  homeShip: number;
  home: number;
  state: VehicleState;
  hp: number;
  /** Crew member flying it, or 0. Required to launch. */
  pilot: number;
  /** Other crew aboard, at most VehicleDef.capacity. */
  passengers: number[];
  dest: VehicleDest | null;
  /** Airlock module it is docked at (state 'docked'), else 0. */
  dock: number;
  /** Hauled items aboard (see VehicleDef.cargo). */
  cargo: ItemQty[];
  /** ShipC entity it holds station beside (a few tiles off its hull) while flying with no destination, else 0/absent. */
  hover?: number;
  /** EVA suits stowed aboard. Absent = the def's `eva.suits`. */
  suits?: number;
  /** Trade: the hold is sealed outbound cargo (being loaded or flown to a buyer); the cargo planner must not unload it. */
  outbound?: boolean;
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
  /** Hand weapon item id issued to the party when it leaves. */
  weapon?: string;
}
export const BoarderC = defineComponent<Boarder>('boarder');
