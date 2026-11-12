import type { RoomSpec } from '../plan';
import type { RoomRole } from '../types';

/**
 * Station flows: the department graph a station is planned from (docs/STATIONFLOWS.md, docs/STATION_FLOW_WHEEL.md).
 * A flow is topology and intent only. It names no direction, radius or coordinate: the planner (planner.ts) finds a
 * structure that honours it, and one flow has several.
 */

export type Dir = 'n' | 'e' | 's' | 'w';
export const DIRS: readonly Dir[] = ['n', 'e', 's', 'w'];

/**
 * Where a department may stand:
 *   arm    lining a street inside the ring
 *   wing   lining a street that runs out through the hull (docks go on wings)
 *   band   in the ring's band, against the hull; with 'arm' too, what the band cannot hold lines a street instead
 *   court  where the public streets leave the central court, shared between them
 *   corner in the cut corners of a square outline, one room each (where the outline has them)
 */
export type Place = 'arm' | 'wing' | 'band' | 'court' | 'corner';

export interface FlowDeptDef {
  id: string;
  /** The plan's rooms it takes, by role. A room goes to the first department that lists its role. */
  roles: readonly RoomRole[];
  /** Controlled: one entrance, a gate, and nothing else on its street. */
  access?: 'open' | 'controlled';
  place: readonly Place[];
  /** Docks it takes: a number, or 'all' the rest. Docks stand on a wing. */
  docks?: number | 'all';
  /** A customs gate at the foot of its wing: everything arriving passes it. */
  customs?: boolean;
  /** Filler: as many of its rooms as its frontage affords, none of them required (a market's shops). */
  fill?: boolean;
  /** Stands on the inner part of the arm whose wing holds this department (a market street between harbour and court). */
  with?: string;
}

export interface FlowPrefDef { kind: 'near' | 'far'; a: string; b: string; weight?: number }

export interface StationFlowDef {
  name: string;
  depts: readonly FlowDeptDef[];
  prefs: readonly FlowPrefDef[];
  intent: {
    /** The department that should read as the station's landmark mass. */
    landmark?: string;
    /** The court at the centre: none (a plain crossing), a small rotunda, or a large market court. */
    court: 'none' | 'small' | 'large';
  };
}

/** A department with its rooms for one station. */
export interface Dept { def: FlowDeptDef; rooms: RoomSpec[]; docks: RoomSpec[] }

/**
 * The skeleton's independent choices. Any outline goes with any street pattern; what a flow cannot be built on (two
 * wings and a gated street on a spine) the planner reports instead of bending.
 *   outline  a stepped disc, or a square with cut corners (each corner one room with a diagonal hull)
 *   streets  cross: four streets from the court; tee: three; spine: one street straight through
 */
export interface Kit { outline: 'disc' | 'square'; streets: 'cross' | 'tee' | 'spine' }
export const KITS: readonly Kit[] = (['disc', 'square'] as const).flatMap((outline) => (['cross', 'tee', 'spine'] as const).map((streets) => ({ outline, streets })));
