import type { ItemQty, ShipTemplate } from '../registry';

/**
 * Procedural ship layouts, in stages: pick a ship role and a hull archetype (weighted by the faction's architectural
 * policy and the sector depth), plan the modules from the budget, build the structure (corridors, hubs, rails,
 * sections, rooms sized to what they will hold, zoned by function), place the modules, then validate.
 */

/** What a room is for. */
export type RoomRole =
  | 'bridge' | 'engine' | 'reactor' | 'weapons' | 'shields' | 'cargo' | 'quarters' | 'core' | 'hangar' | 'hall'
  | 'dock' | 'support';

/** Structural topologies the builder knows. Factions weight them; any faction could use any. */
export type ArchetypeId =
  /** One spine corridor, mirrored room strips, a nose, an engineering transverse at the stern. */
  | 'spine'
  /** Two parallel corridors joined in a loop around a compartment band; nose; stern transverse. */
  | 'ring'
  /** Two corridors around a hangar band, sponsons outboard, engines on two nacelles. */
  | 'carrier'
  /** A processing core with struts out to module pods; no bridge or hallway. */
  | 'hub'
  /** Parallel rails joined by struts, pods hung off them, engines at the rail ends. */
  | 'rails'
  /** Distributed clusters (a junction and its pods) linked by long thin struts. */
  | 'clusters'
  /** Salvaged sections of different build joined by narrow offset connectors; strapped-on engines. */
  | 'salvage';

/**
 * A hand-made piece of hull, drawn with the bow to the west (-x). '.' outside, '#' wall, 'D' a door on the attach
 * edge (a nose's east column). Floor letters name the room: b bridge, e engine, r reactor, w weapons, s shields,
 * c cargo, q quarters, a core, g hangar, h hall, k dock, u support; an upper-case letter is a second room of the same
 * role. Chunks must be closed by walls on their own.
 */
export interface ChunkDef {
  id: string;
  rows: string[];
  weight?: number;
}

/** A value that grows with sector depth: min(max, floor(base + perDepth * depth)). */
export interface Scaled {
  base: number;
  perDepth: number;
  max: number;
}

/** Difficulty budget, all scaled by depth. */
export interface ShipBudget {
  weapons: Scaled;
  /** Chance (0..100 per weapon) of drawing from the heavy pool instead of the light one. */
  heavyPct: Scaled;
  shields: Scaled;
  engines: Scaled;
  /** Most reactors the ship may carry. */
  reactors: Scaled;
  pointDefense: Scaled;
  crew: Scaled;
  /** Storage crates. */
  crates: Scaled;
  /** Structural complexity: extra pods, sections, loops or clusters. */
  size: Scaled;
}

export interface Weighted<T> {
  value: T;
  weight: number;
}

/** A ship role within a faction: what it is for, which archetypes fit, and how it bends the budget. */
export interface ShipRoleDef {
  id: string;
  /** Pick weight, scaled by depth (a role can appear only deeper). */
  weight: Scaled;
  archetypes: readonly Weighted<ArchetypeId>[];
  /** Added to the budget values (after scaling). */
  bonus?: Partial<Record<keyof ShipBudget, number>>;
  /** Shuttle bays (with shuttles). */
  bays?: number;
}

/** The architectural policy of a faction: how the builder shapes its ships. */
export interface ArchitectureDef {
  roles: readonly ShipRoleDef[];
  /** Chance a topology that can be mirrored is mirrored. */
  symmetry: number;
  /** Corridor interior width range. */
  corridorWidth: readonly [number, number];
  /** Strut / connector length range (tiles of corridor between parts). */
  strutLength: readonly [number, number];
  /** Weapons per weapon room (1 = single mounts, 2 = batteries). */
  battery: number;
  /** Hand-made noses for nose-led archetypes (spine, ring, carrier). */
  noses: readonly ChunkDef[];
}

export interface FactionDef {
  name: string;
  /** Building style id; also the art lookup key. */
  motif: string;
  /** Art variants for the renderer (looked up later; no art is generated here). */
  art: { hull: string; wall: string; roof: string; livery: string; signature: readonly string[] };
  architecture: ArchitectureDef;
  weapons: { light: readonly Weighted<string>[]; heavy: readonly Weighted<string>[] };
  shields: readonly Weighted<string>[];
  /** Crate stock: each crate rolls each entry in [min, max]. */
  stock: readonly { item: string; min: number; max: number }[];
  /** Crew are living and breathing: beds for every crew member and life support. */
  living: boolean;
  /** Has an AI core (needed for point defence). */
  aiCore: boolean;
  crew: { required: readonly string[]; pool: readonly Weighted<string>[]; species: readonly string[] };
  doctrine: { targeting: NonNullable<ShipTemplate['doctrine']>; boarding?: NonNullable<ShipTemplate['boarding']> };
  budget: ShipBudget;
}

/** Where a generated ship came from: stored on its ship entity. */
export interface GenOrigin {
  faction: string;
  seed: number;
  depth: number;
}

/** One room of a generated layout. */
export interface GenRoom {
  id: number;
  role: RoomRole;
  tiles: number[];
}

export interface GenResult {
  template: ShipTemplate;
  rooms: GenRoom[];
  /** Index of the room each tile belongs to (-1 none), row-major over the template. */
  roomOf: Int16Array;
  width: number;
  height: number;
  /** Ship role and archetype picked, and a one-line description of the topology built. */
  role: string;
  archetype: ArchetypeId;
  topology: string;
  /** Attempts used (1 = first seed worked). */
  attempts: number;
  /** Problems of the accepted layout (empty when valid). */
  problems: string[];
  /** Why earlier attempts were rejected. */
  failures: string[];
}

export type { ItemQty };
