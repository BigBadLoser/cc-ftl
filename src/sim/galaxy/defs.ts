/**
 * Galaxy content types: the political factions that hold territory and the fixed structures nodes carry. Content lives
 * in src/content/galaxy.ts (`satisfies GalaxyFactionDef` / `StructureDef`). Galaxy factions sit above the ship
 * generator factions (`content.factions`, building styles): a faction says which generator styles its ships use.
 */

import type { Weighted as GenWeighted } from '../shipgen/types';

/** A weighted choice (the ship generator's shape); string ids by default. */
export type Weighted<T = string> = GenWeighted<T>;

/** A danger-tier range, both ends inclusive and optional. */
export interface DangerRange {
  min?: number;
  max?: number;
}

/**
 * A faction as standing and territory see it. The galaxy faction table is the one table: each def carries the reputation key
 * it is tracked under (`sim.story.reputation`, the key trade's `TradeFactionDef.reputation` uses too). Several factions may
 * share a key (the corporations share 'corp'): reputation is per key, standing is per faction.
 */
export interface GalaxyFactionDef {
  name: string;
  kind: 'government' | 'corporation' | 'pirates' | 'rogue' | 'civilian';
  /** Key into `sim.story.reputation`: 'traders' | 'corp' | 'navy' | 'pirates' | 'drones' (trade's keys). */
  reputation: string;
  /** Territory tint on the starmap (UI only). */
  color: string;
  /** Generator factions (`content.factions` ids) its ships are built by, weighted. */
  ships: readonly Weighted[];
  /** Side its ships take in combat when it is hostile: the rogue AI fights everyone ('rogue'); default 'hostile'. */
  combatFaction?: 'hostile' | 'rogue';
  /**
   * Claim on territory seeds: the weight of owning a seed whose danger tier is in range, and how far its space reaches
   * from the seed (default TERRITORY_REACH). Absent = holds no territory.
   */
  territory?: { weight: number; danger?: DangerRange; reach?: number };
  /** Station kinds (StructureDef ids) it builds in its own sectors, weighted. */
  stations?: readonly Weighted[];
  /** Standing before any reputation is earned. */
  baseStanding: number;
  /** Always hostile whatever the reputation (the rogue AI). */
  alwaysHostile?: true;
  /** -1..1 per other faction id: reputation with them spills over into this one, scaled by STANDING_SPILLOVER. */
  relations?: Record<string, number>;
  /** Weight as a ship turning up in a node, by danger tier (owners of the territory get TERRITORY_TRAFFIC on top). */
  traffic?: { weight: number; danger?: DangerRange };
  /** The start node's territory belongs to it. */
  home?: true;
}

/** A fixed structure a node can hold. It is a descriptor until the node grids can place it (sector refactor). */
export interface StructureDef {
  name: string;
  kind: 'asteroids' | 'station' | 'derelict';
  station?: 'trade' | 'military' | 'research';
  /** One or two characters for the starmap badge. */
  badge: string;
  /** Items the node is a source of: a hint for the UI and for later mining, salvage and stores. */
  resources: readonly string[];
  /** Chance per node of holding one (asteroids, derelicts), plus `perDanger` per danger tier. Stations are placed per sector. */
  chance?: number;
  perDanger?: number;
  /** Services a station offers ('fuel', 'trade', 'repair', 'recruit'); the trade layer reads them. */
  services?: readonly string[];
}

/** Standing tiers on top of reputation. */
export type StandingTier = 'hostile' | 'neutral' | 'friendly';

export const inDanger = (r: DangerRange | undefined, danger: number): boolean =>
  !r || (danger >= (r.min ?? -Infinity) && danger <= (r.max ?? Infinity));

/** Everything the galaxy generator reads from content (`ContentRegistry.galaxy`). */
export interface GalaxyContent {
  /** By faction id (also the reputation key). */
  factions: Record<string, GalaxyFactionDef>;
  /** By StructureDef id (`structure.*`). */
  structures: Record<string, StructureDef>;
  /** Name parts for sectors: a prefix plus a suffix ("Kessa Reach"). Nodes add a Greek letter. */
  names: { prefix: readonly string[]; suffix: readonly string[] };
}
