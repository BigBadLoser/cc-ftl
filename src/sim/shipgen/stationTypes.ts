import type { Faction } from '../combat/components';
import type { RoomRole, TransitionStyle, Weighted } from './types';

/**
 * Station templates (`stationGen.ts`): immobile structures built by the shipgen arranger from the civil station
 * builders, sized by tier and fitted out by kind. They carry no FTL drive and no main engines.
 */

export type StationKind = 'trading' | 'mining' | 'farming' | 'military' | 'pirate' | 'research';
export type StationSize = 'outpost' | 'station' | 'hub';
export const STATION_SIZES: readonly StationSize[] = ['outpost', 'station', 'hub'];

/** Station topologies (see stationGrammars.ts). */
export type StationGrammar =
  | 'stationRing' | 'stationLattice' | 'stationHub' | 'stationWelded' | 'stationWheel' | 'stationConcentric' | 'stationArc'
  | 'stationSpine' | 'stationCross' | 'stationTree' | 'stationAnnex';

/** A kind-specific room: its role, the modules it holds, its interior size, and how many per size tier. */
export interface StationRoomDef {
  role: 'farm' | 'industry' | 'armoury' | 'cargo' | 'quarters' | 'support';
  mods: readonly string[];
  w: number;
  h: number;
  count: Readonly<Record<StationSize, number>>;
  /** Storage in this room starts stocked with these (instead of the station's general stock). */
  items?: readonly { item: string; min: number; max: number }[];
}

/** What one size tier of a kind carries. */
export interface StationTier {
  crew: number;
  guns: number;
  /** Chance (0..100) per gun of drawing from the heavy pool. */
  heavyPct: number;
  shields: number;
  pointDefense: number;
  crates: number;
  /** Airlock docks (at least). */
  docks: number;
  grammars: readonly Weighted<StationGrammar>[];
  /** Ore cages (rows of ore holds on a rail) hung off the structure: mining stations. */
  cages?: number;
  /** Shuttle bays (hangars), for boarding parties and patrols. */
  bays?: number;
}

export interface StationDef {
  name: string;
  kind: StationKind;
  /** Combat side of a spawned station (spawning is a later slice). */
  side: Faction;
  motif: string;
  /** Share (0..1) of the crew who are security (armed fighters, `role.security`). */
  security: number;
  /** Role ids of the non-security crew, weighted; the first `required` always come aboard. */
  crew: { required: readonly string[]; pool: readonly Weighted<string>[]; species: readonly string[] };
  weapons: { light: readonly Weighted<string>[]; heavy: readonly Weighted<string>[] };
  shields: readonly Weighted<string>[];
  stock: readonly { item: string; min: number; max: number }[];
  transition: TransitionStyle;
  tiers: Readonly<Record<StationSize, StationTier>>;
  rooms: readonly StationRoomDef[];
  /**
   * Enclosed centres (ring courtyards, sectors between spokes) become open rooms of this role, with this chance. Big
   * ones are lined with a band of `band` rooms (in turn round the court), leaving a smaller court in the middle;
   * `packed` bands run unbroken along each wall. A `deck` court may become the hangar deck, taking over the planned
   * shuttle bays.
   */
  atrium?: { role: 'plaza' | 'garden' | 'drill'; chance: number; band: readonly RoomRole[]; packed?: boolean; deck?: boolean };
}

/** Largest template a station may have (tiles per side): a hub is much bigger than any ship but stays one region. */
export const STATION_MAX = 160;

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
