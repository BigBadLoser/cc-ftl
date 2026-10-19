import { defineComponent } from './ecs';

/**
 * A free body in the sector: continuous position in sector tiles (a tile's centre is at +0.5), heading in radians (atan2 of
 * dy, dx in sector space; 0 = +x) and altitude in tiles over the deck. Shuttles carry one now; pods, cargo carriers, drones
 * and debris later. Bodies never collide with tiles. An attached body (a stowed or docked vehicle) is pinned to its
 * attachment point every tick by the system that owns it.
 */
export interface Body {
  x: number;
  y: number;
  heading: number;
  alt: number;
}
export const BodyC = defineComponent<Body>('body');

/**
 * Altitudes (tiles over the deck). They switch with the vehicle state, with no ramp: the lift out of the bay and the dock
 * slide are render timing (shuttleView, vehicleBayArt), and a sim ramp would move the air-layer switch off the art's frames.
 * ROOF is the roof top (render `heights.ROOF_Z`); a body above it is drawn in the air layer, over every tile and roof.
 */
export const ALT = {
  /** Parked in a bay. */
  stowed: 0,
  /** Latched to an airlock: the docking hatch level with the collar (hull height). */
  docked: 0.95,
  /** Flying or hovering. */
  cruise: 2.5,
  roof: 2.05,
} as const;

/** True if a body flies above every roof (the air layer); false at hull height or lower (sorted with the ships' tiles). */
export const isAirborne = (b: Body): boolean => b.alt > ALT.roof;
