/**
 * Galaxy content types: the political factions that hold territory and the fixed structures nodes carry. Content lives
 * in src/content/galaxy.ts (`satisfies GalaxyFactionDef` / `StructureDef`). Galaxy factions sit above the ship
 * generator factions (`content.factions`, building styles): a faction says which generator styles its ships use.
 */

import type { Weighted as GenWeighted } from '../shipgen/types';

/** A weighted choice (the ship generator's shape); string ids by default. */
export type Weighted<T = string> = GenWeighted<T>;

/** What a fleet does for a living. Its agenda (agenda.ts) follows from it. */
export type FleetRole = 'trader' | 'miner' | 'patrol' | 'pirate' | 'raider';

/** A ship's size class, from the generator's hull families (`FleetContent.classes`). */
export type ShipSize = 'small' | 'medium' | 'heavy';

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
  /** The fleets its ports field: which roles, and each role's group budget. Absent = no ships of its own. */
  fleet?: FactionFleetDef;
}

/**
 * A group (fleet) of a role. Its size is a budget: a group's `budget` is drawn (weighted), then ships are drawn from `sizes` (weighted) while
 * their `FleetContent.sizeCost` fits in what is left, up to `maxShips`. So a navy patrol with budget 4 is two small ships (2 + 2), one medium
 * (3) or one heavy (4); pirates mostly get budget 2 (one small ship) and sometimes 4 (two). `maxShips: 1` makes the group always a single ship.
 */
export interface FleetGroupDef {
  /** Weight of this role among the groups a plain station of the faction fields (dens, depots, outposts and nests each field one role). */
  weight: number;
  budget: readonly Weighted<number>[];
  sizes: readonly Weighted<ShipSize>[];
  maxShips: number;
}

export interface FactionFleetDef {
  groups: Partial<Record<FleetRole, FleetGroupDef>>;
  /** Ship names: `prefix` (optional), then one of `first`, then one of `second` (optional), joined by spaces. */
  names: { prefix?: string; first: readonly string[]; second?: readonly string[] };
}

/** Where a faction's ships call home: stations, dens, depots, mining outposts and drone nests (derived from structures, ports.ts). */
export type PortKind = 'station' | 'den' | 'depot' | 'outpost' | 'nest';

export interface PortKindDef {
  name: string;
  /** Groups the port fields at size 1, 2 and 3. */
  groups: readonly [number, number, number];
  /** Turns the port takes to build one replacement ship. */
  rebuildTurns: number;
}

/** A hull family of a generator faction as a ship: its size class and the roles it can serve (any when absent). */
export interface ShipClassDef {
  size: ShipSize;
  roles?: readonly FleetRole[];
}

/** Fleet tables the roster (roster.ts) reads: size costs, hull classes by generator faction and family, port kinds. */
export interface FleetContent {
  sizeCost: Record<ShipSize, number>;
  classes: Record<string, Record<string, ShipClassDef>>;
  ports: Record<PortKind, PortKindDef>;
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

/** Units a port produces or consumes per turn at size 1 (scaled by its size). */
export interface MarketRates {
  produce?: Readonly<Record<string, number>>;
  consume?: Readonly<Record<string, number>>;
}

/**
 * The NPC economy's tables (market.ts). `profiles` is the trade profile (`TradeDef.traders`) whose stock is a port kind's baseline (null = no market);
 * a plain station is a farm (`farm.profile`) with chance `farm.chance`. `rates` are per profile; `goods` are the commodities NPC traders carry.
 */
export interface MarketContent {
  profiles: Record<PortKind, string | null>;
  farm: { profile: string; chance: number };
  /** The trade profile of a research station's market (instead of the plain station profile). */
  research?: string;
  rates: Record<string, MarketRates>;
  goods: readonly string[];
}

/** Everything the galaxy generator reads from content (`ContentRegistry.galaxy`). */
export interface GalaxyContent {
  /** By faction id (also the reputation key). */
  factions: Record<string, GalaxyFactionDef>;
  /** By StructureDef id (`structure.*`). */
  structures: Record<string, StructureDef>;
  /** Name parts for sectors: a prefix plus a suffix ("Kessa Reach"). Nodes add a Greek letter. */
  names: { prefix: readonly string[]; suffix: readonly string[] };
  fleet: FleetContent;
  market: MarketContent;
}
