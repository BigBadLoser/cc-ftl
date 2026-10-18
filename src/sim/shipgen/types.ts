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
  | 'salvage'
  /** Assembly-driven: standard functional sections composed by constraints (v3; navy first). */
  | 'sections';

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

/** Navy hull grammars (see navyGrammars.ts). */
export type NavyGrammar = 'linear' | 'deckPair' | 'spineDecks' | 'spineWings' | 'citadelFlanked' | 'twinHull' | 'layered' | 'carrierIsland' | 'flightDeck' | 'spineMounts';
/** Drone (machine) grammars (see droneGrammars.ts). */
export type DroneGrammar = 'spoke' | 'truss' | 'cluster';
/** Scrapper (salvage) grammars (see scrapGrammars.ts). */
export type ScrapGrammar = 'heap' | 'raft' | 'chain';
/** Salvage donor sections: navy and drone ones are cut from those factions' own generators, the rest are hand-made. */
export type DonorKind =
  | 'navyBow' | 'navyDrive' | 'navyBattery' | 'navyHulk' | 'droneSection'
  | 'freighter' | 'habitat' | 'liner' | 'station' | 'barge' | 'podString' | 'tug';

/** Standard functional sections of a navy hull (one per kind of job). */
export type SectionKind = 'command' | 'battery' | 'core' | 'habitat' | 'cargo' | 'hangar' | 'drive';

/**
 * A hull family: standardised engineering with its own proportions. The sections a ship needs come from its plan;
 * the family sets their depth (rooms per side), gun columns, sponsons, and which jobs get their own sections.
 */
export interface HullFamilyDef {
  id: string;
  weight: Scaled;
  bonus?: Partial<Record<keyof ShipBudget, number>>;
  bays?: number;
  /** Interior depth of each section's room band (per side), [min, max]. */
  depth: Partial<Record<SectionKind, readonly [number, number]>>;
  /** Gun columns per side in one battery section. */
  batteryCols: readonly [number, number];
  /** Chance a battery section carries its guns in grafted sponsons instead of inside the hull line. */
  sponsonChance: number;
  /** Most rooms per side in a habitat / cargo / core section before it splits in two. */
  sectionRooms: number;
  /** One combined section for core, crew and stores (small hulls). */
  merge?: boolean;
  /** The core is a citadel: an enclosed compartment on the axis, passages around it, crew quarters outboard. */
  citadel?: boolean;
  /** Structural grammars the family uses (how its sections are arranged in 2D), weighted. */
  grammars: readonly Weighted<NavyGrammar | DroneGrammar | ScrapGrammar>[];
  /** Soft proportion target (length / beam): arrangements nearer it score better; never a hard reject. */
  aspect: readonly [number, number];
  /** Propulsion configurations the family uses (engines always face +x). */
  /** Salvage families: how much this role wants each donor aboard (by function), and which donors can anchor. */
  donors?: Partial<Record<DonorKind, number>>;
  anchors?: readonly Weighted<DonorKind>[];
  propulsion: readonly ('bank' | 'cluster' | 'nacelles' | 'wingPods' | 'sideDrives')[];
}

/** Diagnostic metric bands: a generated ship outside a band is rejected and reseeded. */
export type MetricId = 'compactness' | 'occupancy' | 'corridorRatio' | 'narrowLinks' | 'aspect' | 'beamShare';
export type MetricBands = Partial<Record<MetricId, readonly [number, number]>>;

export interface FactionDef {
  name: string;
  /** Building style id; also the art lookup key. */
  motif: string;
  /** Art variants for the renderer (looked up later; no art is generated here). */
  art: { hull: string; wall: string; roof: string; livery: string; signature: readonly string[] };
  architecture: ArchitectureDef;
  /** Assembly-driven generation (v3): hull families. When present, the faction uses the composer instead of v2. */
  hullFamilies?: readonly HullFamilyDef[];
  /** Salvage sources: the factions whose generators build navy- and drone-origin donors, and the families they use. */
  salvage?: Partial<Record<'navy' | 'drone', { faction: FactionDef; families: readonly string[] }>>;
  metrics?: MetricBands;
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
  /** Diagnostic metrics of the layout. */
  metrics?: Record<MetricId, number>;
  /** Assemblies, ports, joins and traversal (assembly-driven generation only), for the viewer. */
  debug?: CompDebug;
}

export type AccessKind = 'human' | 'robot' | 'external';
export type JoinKind = 'frame' | 'graft' | 'beam';

/** A functional assembly as placed: its kind, label, who must reach it, its bounds and the parts it is made of. */
export interface AsmRecord {
  id: number;
  kind: string;
  label: string;
  access: AccessKind;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Donor origin of a salvaged section (navy, civil, drone, mining) or 'scrap' for improvised parts. */
  donor?: string;
}

/** An access port on an assembly's boundary: a tile, the side it faces, and whether a neighbour's port met it. */
export interface PortRecord {
  asm: number;
  x: number;
  y: number;
  dir: 'n' | 's' | 'e' | 'w';
  access: AccessKind;
  matched: boolean;
}

/** A structural connection between two assemblies, with the tiles it runs through. */
export interface JoinRecord {
  kind: JoinKind;
  a: number;
  b: number;
  tiles: { x: number; y: number }[];
}

export interface CompDebug {
  assemblies: AsmRecord[];
  /** Assembly index per tile (-1 none), same frame as the template rows. */
  asmOf: Int16Array;
  ports: PortRecord[];
  joins: JoinRecord[];
  /** Walkable traversal tiles with the access kind they serve. */
  traversal: { x: number; y: number; access: AccessKind }[];
  /** Section sequence and depths, e.g. 'C B4 K3 H3 D' (for diversity checks). */
  profile: string;
}

export type { ItemQty };
