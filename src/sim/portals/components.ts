import { defineComponent } from '../ecs';

/** One end of a portal: a walkable tile on a grid. `airlock` is the module entity when the tile is an airlock's outer door. */
export interface PortalEnd {
  gridId: number;
  x: number;
  y: number;
  airlock?: number;
}

export type PortalKind = 'airlock' | 'eva' | 'teleporter' | 'dock';
export const PORTAL_KINDS: readonly PortalKind[] = ['airlock', 'eva', 'teleporter', 'dock'];

/** What a crew member needs to use a portal. Airlock ends add their own implied requirement (working, cycled open). */
export type PortalRequirement =
  /** The crew member wears an EVA suit (SuitC). */
  | { type: 'suit' }
  /** The module entity is enabled, intact and powered (a teleporter pad, a tether winch). */
  | { type: 'powered'; module: number };

/**
 * A typed link between a tile on one grid and a tile on another (or the same) grid. Portals are entities, so they
 * save with the world. Walking is two-way unless `oneWay` (then only a -> b).
 */
export interface Portal {
  kind: PortalKind;
  a: PortalEnd;
  b: PortalEnd;
  /** Planner weight, in the pathfinder's units (an orthogonal step is 10). */
  cost: number;
  /** Ticks a traversal takes; the crew member changes grid when it ends. */
  ticks: number;
  requires: PortalRequirement[];
  oneWay?: boolean;
}
export const PortalC = defineComponent<Portal>('portal');

/** A crew member in the middle of a traversal. Their Position stays on the source end until `ticks` run out. */
export interface Crossing {
  portal: number;
  /** Which end they entered from. */
  from: 'a' | 'b';
  ticks: number;
}
export const CrossingC = defineComponent<Crossing>('crossing');

/**
 * This crew member wears an EVA suit (own air supply, can use 'suit' portals). `air` is seconds left in the tank and
 * `airlock` the module entity it was taken from; both are absent on a suit made by `suit.set` (full tank, no home).
 * Taking the suit off at an airlock returns it there with a full tank.
 */
export interface Suit {
  worn: true;
  air?: number;
  airlock?: number;
}
export const SuitC = defineComponent<Suit>('suit');

export type AirlockState = 'inner' | 'outer' | 'toOuter' | 'toInner';

/**
 * Cycle state of an airlock module. 'inner': inner door open, chamber pressurised. 'outer': outer door open, chamber
 * in vacuum. The 'to...' states have both doors shut while the chamber pumps its air to / from the ship.
 */
export interface Airlock {
  state: AirlockState;
  /** Ticks left in a cycle. */
  timer: number;
  /** Side someone wants open; written by crew waiting at a door and by airlock.cycle, consumed by the airlock system. */
  request: 'inner' | 'outer' | null;
  /** Free suits stowed here. Absent (an old save) = the def's `airlock.suits`. */
  suits?: number;
}
export const AirlockC = defineComponent<Airlock>('airlock');
