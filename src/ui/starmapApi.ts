/** Starmap view data (published by app/starmapSnapshot.ts). Plain data; map units, y down. */

export interface UiStarSector {
  id: string;
  name: string;
  x: number;
  y: number;
  /** SVG points string of the padded hull. */
  hull: string;
  faction: string | null;
  /** Territory tint (grey for open space). */
  color: string;
  danger: number;
  /** Top of the hull (map y), where the label goes, and the sector's radius (map units). */
  top: number;
  r: number;
  /** At least one node discovered: tint and name are shown. */
  known: boolean;
  /** Fluid outline around its nodes and routes (SVG path, map units; evenodd for holes). */
  outline: string;
  /** Its central body (star, gas giant...): kind, position (map units) and radius. */
  body: { kind: string; x: number; y: number; r: number } | null;
  /** Its region (null: unclaimed frontier). */
  region: string | null;
  hub: boolean;
  /** Number of nodes in it. */
  nodes: number;
}

/** A region (a named group of sectors) for the outer zoom levels. */
export interface UiStarRegion {
  id: string;
  name: string;
  /** Type key (core, border, corporate, trade, pirate, machine, frontier, rich) and its label. */
  type: string;
  typeLabel: string;
  faction: string | null;
  color: string;
  /** Centre of its sectors (map units) and their count. */
  x: number;
  y: number;
  sectors: number;
  /** Fluid area over its sectors and the lanes between them (SVG path, map units). */
  outline: string;
  /** One of its sectors is known. */
  known: boolean;
  /** Its name and type are shown: known, or next to the player's region (what to expect beyond the border). */
  revealed: boolean;
  /** The player is in it. */
  current: boolean;
}

/** A way out of the player's sector: the lane from its gateway node to a neighbouring sector. */
export interface UiStarExit {
  id: string;
  ax: number;
  ay: number;
  bx: number;
  by: number;
  /** The sector it leads to: id, name (if known), owner colour, danger. */
  to: string;
  name: string | null;
  color: string;
  danger: number;
  kind: 'lane' | 'gate' | 'rift';
  fuel: number;
}

/** A link between two sectors (level 2) or two regions (level 3). */
export interface UiStarLink {
  id: string;
  ax: number;
  ay: number;
  bx: number;
  by: number;
  /** gate: across a region border; rift: across the void; through: (regions) a route through unclaimed space. */
  kind: 'lane' | 'gate' | 'rift' | 'through';
  /** Touches the player's sector (level 2) or region (level 3). */
  mine: boolean;
  /** How many lanes it stands for (gates between two regions). */
  count: number;
}

export interface UiStarNode {
  id: string;
  sector: string;
  x: number;
  y: number;
  name: string;
  known: boolean;
  visited: boolean;
  current: boolean;
  danger: number;
  faction: string | null;
  /** Structure badges ("T", "A", "D"...). Empty for unknown nodes. */
  badges: string[];
  structures: string[];
  resources: string[];
  /** Ships seen at the node (within sensor range only): hostile and other. */
  hostiles: number;
  others: number;
  /** One jump from the player's node. */
  reachable: boolean;
}

export interface UiStarEdge {
  id: string;
  kind: 'route' | 'hyperlane';
  ax: number;
  ay: number;
  bx: number;
  by: number;
  anchor: boolean;
  gate: boolean;
  rift: boolean;
}

export interface UiStarFaction {
  id: string;
  name: string;
  color: string;
  tier: 'hostile' | 'neutral' | 'friendly';
  standing: number;
}

export interface UiStarmap {
  rev: number;
  current: string;
  fuel: number;
  charge: number;
  chargeMax: number;
  jumps: number;
  days: number;
  /** Map units per danger tier (rings on the map). */
  dangerStep: number;
  sectors: UiStarSector[];
  nodes: UiStarNode[];
  /** Only edges whose both ends are discovered. */
  edges: UiStarEdge[];
  factions: UiStarFaction[];
  /** The player's sector and region. */
  currentSector: string;
  currentRegion: string | null;
  regions: UiStarRegion[];
  exits: UiStarExit[];
  /** Level 2: lanes between sectors (one per sector pair). Level 3: links between regions. */
  sectorLinks: UiStarLink[];
  regionLinks: UiStarLink[];
  /** The nebula backdrop around the player (levels 1 and 2). */
  nebula: UiNebulaTile[];
}

/** A square of terrain density: `n` x `n` samples (0..255, row-major) spanning `size` map units from (x, y). */
export interface UiNebulaTile {
  id: string;
  x: number;
  y: number;
  size: number;
  n: number;
  data: Uint8Array;
}

/** A planned route to a node. */
export interface UiStarRoute {
  to: string;
  path: string[];
  hops: number;
  fuel: number;
  time: number;
  /** FTL charge the next jump needs, and whether the tank and the drive cover the route / the next jump. */
  nextCharge: number;
  fuelOk: boolean;
  chargeOk: boolean;
  /** Why the next jump cannot go now (a short sentence), or null. */
  blocker: string | null;
}
