import type { Faction } from '../combat/components';
import type { Recipe } from './assembly/recipe';
import type { StationDept } from './plan';
import type { Weighted } from './types';

/**
 * Station kinds: immobile structures built by the station assembly (`stationBuild.ts`, `assembly/`) from the kind's
 * recipes, sized by tier and fitted out by kind. They carry no FTL drive and no main engines.
 */

export type StationKind = 'trading' | 'mining' | 'farming' | 'military' | 'pirate' | 'research';
export type StationSize = 'outpost' | 'station' | 'hub';
export const STATION_SIZES: readonly StationSize[] = ['outpost', 'station', 'hub'];

/** A kind-specific room: its role, the modules it holds, its interior size, and how many per size tier. */
export interface StationRoomDef {
  role: 'farm' | 'industry' | 'armoury' | 'cargo' | 'quarters' | 'support' | 'hangar' | 'weapons';
  /** Its department in the station assembly, where the role's own is not it (a drone bay is defence, not works). */
  dept?: StationDept;
  mods: readonly string[];
  w: number;
  h: number;
  count: Readonly<Record<StationSize, number>>;
  /** A drone bay in this room starts with this many drones of this DroneDef id (each bay, up to its slots). */
  drones?: { def: string; count: number };
  /** Storage in this room starts stocked with these (instead of the station's general stock). */
  items?: readonly { item: string; min: number; max: number }[];
}

/** What one size tier of a kind carries. */
export interface StationTier {
  guns: number;
  /** Chance (0..100) per gun of drawing from the heavy pool. */
  heavyPct: number;
  shields: number;
  pointDefense: number;
  crates: number;
  /** Airlock docks (two at least). */
  docks: number;
  /** Shuttle bays (hangars), for boarding parties and patrols (one at least). */
  bays?: number;
  /** Mining pod bays, together on one pod deck (a hangar). */
  pods?: number;
}

export interface StationDef {
  name: string;
  kind: StationKind;
  /** Combat side of a spawned station (spawning is a later slice). */
  side: Faction;
  motif: string;
  /** Crops (CropDef ids) the hydroponics beds of an asteroid base are set to, in turn from the first bed: it farms out of the box (#508). */
  crops?: readonly string[];
  /** The messes' pantries (cold stores and racks) start stocked with these; without it they start empty. Stocked as any store: each store takes what it accepts. */
  pantry?: readonly { item: string; min: number; max: number }[];
  /**
   * The crew sleeps in barracks: rooms of this many beds each (double bunks, so half as many bunks), with this many
   * one-bed cabins beside them. Without it, blocks of one-bed cabins (`assembly/program.ts`).
   */
  barracks?: { beds: readonly [number, number]; cabins?: number };
  /**
   * Spaciousness, rolled per station between these (default [1, 1]): how far rooms grow past what their contents need.
   * Under 1 tight (a navy depot, a pirate den), over 1 roomy (a trade station's halls).
   */
  space?: readonly [number, number];
  /** Share (0..1) of the crew who are security (armed fighters, `role.security`). */
  security: number;
  /** Role ids of the non-security crew, weighted; the first `required` always come aboard. */
  crew: { required: readonly string[]; pool: readonly Weighted<string>[]; species: readonly string[] };
  weapons: { light: readonly Weighted<string>[]; heavy: readonly Weighted<string>[] };
  shields: readonly Weighted<string>[];
  stock: readonly { item: string; min: number; max: number }[];
  tiers: Readonly<Record<StationSize, StationTier>>;
  /** The kind's own rooms (labs, refineries, greenhouses, armouries, stalls), beside the ones every station has. */
  rooms: readonly StationRoomDef[];
  /** The kind's open rooms (a concourse, a garden deck, a drill hall): its power budget allows for their lamps, a garden's beds. */
  atrium?: { role: 'plaza' | 'garden' | 'drill' };
  /**
   * The station assembly's recipes for this kind: its families (its look), each a list of recipes that are the seed's
   * variations. Every station of the kind is built from these (`buildStation`).
   */
  assembly: readonly (readonly Recipe[])[];
  /**
   * The families an asteroid outpost of this kind is built from, when they differ from the station's (`assembly`): a
   * station in space may take shapes that don't sit on a rock.
   */
  outpostAssembly?: readonly (readonly Recipe[])[];
}

/** Station summary attached to a generated station. */
export interface StationInfo {
  kind: StationKind;
  size: StationSize;
  crew: number;
  security: number;
  docks: number;
  guns: number;
  shields: number;
}
