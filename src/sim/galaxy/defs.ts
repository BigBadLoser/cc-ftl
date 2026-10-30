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
 * What an owner faction does to the stock of its stations, within what the station kind allows (the kind decides what is sold, the owner what
 * is more common). Absent = no speciality: everything the kind allows, at the base odds.
 */
export interface FactionSpecialityDef {
  /** Module categories whose blueprints it always stocks; the others it stocks at `OFF_SPECIALITY_STOCK` odds (galaxy/blueprintShop.ts). */
  blueprints?: readonly string[];
  /** Item tag -> weight on the count and chance of its trade stock lines (1 = unchanged). Never adds items the trader kind does not list. */
  stock?: Readonly<Record<string, number>>;
  /** Item tag or id -> multiplier on what its stations sell it for (0.85 = 15% cheaper). */
  prices?: Readonly<Record<string, number>>;
  /**
   * Its best blueprints are gated by standing: category -> `{ tier: least standing }`. A blueprint of that category and tier needs at least that
   * much standing with this faction; a tier with no entry is free.
   */
  gate?: Readonly<Record<string, Readonly<Record<number, number>>>>;
  /**
   * TODO(#125): shipyard modifier (Vantor's bigger caps and cheaper-per-tile hull work). Read by the shipyard service once it lands; nothing reads
   * it yet. `capMult` scales the tiles a visit adds, `tilePrice` the credits and metal per tile.
   */
  shipyard?: { capMult?: number; tilePrice?: number };
}

/** How two factions stand to each other: at war they fight on sight; allied (the zealots and the Rogue AI) never fight, and overrides `alwaysHostile`. */
export type Stance = 'war' | 'neutral' | 'allied';

/**
 * One pair of factions in the relations table (`GalaxyContent.relations`): their stance, and how far each one's reputation with the player
 * spills over into the other's standing (`spill: [into a, into b]`, each -1..1, scaled by STANDING_SPILLOVER). A pair with no entry is neutral
 * and shares nothing.
 */
export interface FactionRelationDef {
  a: string;
  b: string;
  stance: Stance;
  /** [weight of b's reputation in a's standing, weight of a's reputation in b's standing]. */
  spill?: readonly [number, number];
}

/**
 * A faction as standing and territory see it. The galaxy faction table is the one table: each def carries the reputation key
 * it is tracked under (`sim.story.reputation`). Every faction has its own key, so each standing moves on its own; relations between
 * factions live in the pairwise table (`GalaxyContent.relations`).
 */
export interface GalaxyFactionDef {
  name: string;
  kind: 'government' | 'corporation' | 'pirates' | 'rogue' | 'civilian';
  /** Key into `sim.story.reputation`, one per faction (the player's reputation with it). */
  reputation: string;
  /** Generator factions (`content.factions` ids) its ships are built by, weighted. */
  ships: readonly Weighted[];
  /** Side its ships take in combat when it is hostile: the rogue AI fights everyone ('rogue'); default 'hostile'. */
  combatFaction?: 'hostile' | 'rogue';
  /**
   * Claim on territory seeds: the weight of owning a seed whose danger tier is in range, and how far its space reaches
   * from the seed (default TERRITORY_REACH). Absent = holds no territory.
   */
  territory?: {
    weight: number;
    danger?: DangerRange;
    reach?: number;
    /**
     * It does not claim seeds outright but shares out the seeds of another faction (the raider, cartel and mercenary factions share the Scrapper Clans' pirate
     * space): a seed that faction wins is re-drawn among it and its sharers, by `weight`.
     */
    shares?: string;
    /**
     * It takes open or pirate seeds next to a seed of this faction (the zealots, beside the machines): each such seed gives it cells with chance `weight` (0..1),
     * at most `max` (default 1) neighbouring cells. Neither this nor `shares` moves a government's or corporation's map.
     */
    near?: string;
    max?: number;
  };
  /** Station kinds (StructureDef ids) it builds in its own sectors, weighted. */
  stations?: readonly Weighted[];
  /** Standing before any reputation is earned. */
  baseStanding: number;
  /** Always hostile whatever the reputation (the rogue AI). */
  alwaysHostile?: true;
  /** What it stocks more of at its stations, what it sells cheaper, what its best gear is gated by. */
  specialities?: FactionSpecialityDef;
  /** Weight as a ship turning up in a node, by danger tier (owners of the territory get TERRITORY_TRAFFIC on top). */
  traffic?: { weight: number; danger?: DangerRange };
  /** The start node's territory belongs to it. */
  home?: true;
  /** The fleets its ports field: which roles, and each role's group budget. Absent = no ships of its own. */
  fleet?: FactionFleetDef;
  /**
   * Guards its routes (the cartel): its armed fleets interdict only inside its own territory, and keep to it when they hunt; elsewhere they
   * hail like traders.
   */
  guardsRoutes?: true;
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
  /** A hired escort (roster.ts): with `chance` the group gains one more ship, built and named by `faction` (the cartel's mercenaries). */
  escort?: { faction: string; chance: number };
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
  /** Chance per node of holding one (asteroids, derelicts), plus `perDanger` per danger tier. A station with a chance is an extra one (research), rolled per node outside hostile space; the others are placed per sector. */
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
  /** Who is at war with whom, and who shares standing with whom: one entry per pair (relations.ts reads it). */
  relations: readonly FactionRelationDef[];
  /** By StructureDef id (`structure.*`). */
  structures: Record<string, StructureDef>;
  /** Name parts for sectors: a prefix plus a suffix ("Kessa Reach"). Nodes add a Greek letter. */
  names: { prefix: readonly string[]; suffix: readonly string[] };
  fleet: FleetContent;
  market: MarketContent;
}
