import type { ItemQty, ShipTemplate } from '../registry';

/**
 * Procedural ship layouts. A faction picks a building style (its motif); the generator assembles a silhouette from
 * the motif's hand-made chunks, assigns room roles and places modules within a budget scaled by sector depth.
 */

/** What a room is for. The generator fills each role with its own module rules. */
export type RoomRole =
  | 'bridge' | 'engine' | 'reactor' | 'weapons' | 'shields' | 'cargo' | 'quarters' | 'core' | 'hangar' | 'hall';

/**
 * A hand-made piece of hull, drawn with the bow to the west (-x). '.' outside, '#' wall, 'D' a door on the attach
 * edge (bow: east column, stern: west column, pod and nub: bottom row). Floor letters name the room:
 * fixed roles b bridge, e engine, r reactor, w weapons, s shields, c cargo, q quarters, a core, g hangar, h hall;
 * an upper-case letter is a second room of the same role; digits 1-9 are free slots whose role the generator draws from the faction's room pool. Each distinct letter in a
 * chunk is one room. Chunks must be closed by walls on their own.
 */
export interface ChunkDef {
  id: string;
  rows: string[];
  /** Relative pick weight (default 1). */
  weight?: number;
}

/** Hull-assembly rules of a motif. */
export interface HullGrammar {
  /** 'mirror': south pods mirror north pods exactly; 'loose': mirrored shape, rooms may differ; 'none': independent sides. */
  symmetry: 'mirror' | 'loose' | 'none';
  /** Corridor interior width (rows); chunks' door blocks are aligned to it. */
  corridorWidth: readonly [number, number];
  /** Repeat one pod design along each side (drone pods). */
  repeatPods: boolean;
  /** Chance per pod of a bolted-on nub chunk on its outer wall. */
  nubChance: number;
  /** Chance per pod slot of a one-tile gap (open corridor wall) before the pod: irregular edges. */
  gapChance: number;
}

/** A value that grows with sector depth: min(max, floor(base + perDepth * depth)). */
export interface Scaled {
  base: number;
  perDepth: number;
  max: number;
}

/** Difficulty budget, all scaled by depth. */
export interface ShipBudget {
  /** Pods along each side of the corridor (sets the hull length). */
  pods: Scaled;
  weapons: Scaled;
  /** Chance (0..100 per weapon, scaled) of drawing from the heavy pool instead of the light one. */
  heavyPct: Scaled;
  /** Shield generators. */
  shields: Scaled;
  engines: Scaled;
  /** Most reactors the ship may carry (power cap). */
  reactors: Scaled;
  pointDefense: Scaled;
  crew: Scaled;
}

export interface Weighted<T> {
  value: T;
  weight: number;
}

/** Extra modules a room role gets, beyond the ones the generator places from the budget. */
export interface FillRule {
  def: string;
  min: number;
  max: number;
  /** Starting stock for storage modules: each crate gets one entry, count rolled in [min, max]. */
  stock?: readonly { item: string; min: number; max: number }[];
}

export interface FactionDef {
  name: string;
  /** Building style id; also the art lookup key. */
  motif: string;
  /** Art variants for the renderer (looked up later; no art is generated here). */
  art: { hull: string; wall: string; roof: string; livery: string; signature: readonly string[] };
  hull: HullGrammar;
  chunks: { bows: readonly ChunkDef[]; sterns: readonly ChunkDef[]; pods: readonly ChunkDef[]; nubs: readonly ChunkDef[] };
  /** Pool for digit slots. */
  rooms: readonly Weighted<RoomRole>[];
  /** Roles the ship must have at least once among its slots (beyond bridge and engine). */
  requiredRooms: readonly RoomRole[];
  /** Per-role extras (crates, fabricators, lights are automatic). */
  fill: Partial<Record<RoomRole, readonly FillRule[]>>;
  weapons: { light: readonly Weighted<string>[]; heavy: readonly Weighted<string>[] };
  shields: readonly Weighted<string>[];
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
  /** Attempts used (1 = first seed worked). */
  attempts: number;
  /** Problems of the accepted layout (empty when valid). */
  problems: string[];
}

export type { ItemQty };
