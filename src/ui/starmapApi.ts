/** Starmap view data (published by app/starmapSnapshot.ts). Plain data; map units, y down. */

/** A theme colour by token name (`--cyan`...): the view maps it through `starmapStyle.ts`; the data holds no CSS. */
export type Tone = 'cyan' | 'amber' | 'green' | 'red' | 'text' | 'dim';

export interface UiStarSector {
  id: string;
  name: string;
  x: number;
  y: number;
  faction: string | null;
  /** Territory tint (dim for open space). */
  tone: Tone;
  danger: number;
  /** Top of the sector (map y), where the label goes, and the sector's radius (map units). */
  top: number;
  r: number;
  /** At least one node discovered: tint and name are shown. */
  known: boolean;
  /** Fluid outline around its nodes and routes (SVG path, map units; evenodd for holes). */
  outline: string;
  /** Its central body (star, gas giant...): kind, position (map units) and radius. */
  body: { kind: string; x: number; y: number; r: number } | null;
  /** Its cluster (null: unclaimed frontier). */
  cluster: string | null;
  hub: boolean;
  /** Number of nodes in it. */
  nodes: number;
}

/** A cluster (a named group of sectors) for the outer zoom levels. */
export interface UiStarCluster {
  id: string;
  name: string;
  /** Type key (core, border, corporate, trade, pirate, machine, frontier, rich) and its label. */
  type: string;
  typeLabel: string;
  faction: string | null;
  tone: Tone;
  /** Centre of its sectors (map units) and their count. */
  x: number;
  y: number;
  sectors: number;
  /** Fluid area over its sectors and the lanes between them (SVG path, map units). */
  outline: string;
  /** One of its sectors is known. */
  known: boolean;
  /** Its name and type are shown: known, or next to the player's cluster (what to expect beyond the border). */
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
  /** The sector it leads to: id, name (if known), owner tint, danger. */
  to: string;
  name: string | null;
  tone: Tone;
  danger: number;
  kind: 'lane' | 'gate' | 'rift';
  fuel: number;
}

/** A link between two sectors (level 2) or two clusters (level 3). */
export interface UiStarLink {
  id: string;
  ax: number;
  ay: number;
  bx: number;
  by: number;
  /** gate: across a cluster border; rift: across the void; through: (clusters) a route through unclaimed space. */
  kind: 'lane' | 'gate' | 'rift' | 'through';
  /** Touches the player's sector (level 2) or cluster (level 3). */
  mine: boolean;
  /** How many lanes it stands for (gates between two clusters). */
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
  tone: Tone;
  tier: 'hostile' | 'neutral' | 'friendly';
  standing: number;
}

export interface UiStarmap {
  rev: number;
  current: string;
  /** The player's ship (ShipC entity), 0 while none is in the sector (deploying). */
  ship: number;
  fuel: number;
  charge: number;
  chargeMax: number;
  jumps: number;
  /** The starmap turn (one per hop entered). */
  turn: number;
  /** 'active': in a node; 'hyperspace': travelling (see `travel`); 'deploying': dropped out, placing the ship. */
  state: 'active' | 'hyperspace' | 'deploying';
  /** The hyperspace trip in progress. */
  travel: UiTravel | null;
  /** Map units per danger tier (rings on the map). */
  dangerStep: number;
  sectors: UiStarSector[];
  nodes: UiStarNode[];
  /** Only edges whose both ends are discovered. */
  edges: UiStarEdge[];
  factions: UiStarFaction[];
  /** The player's sector and cluster. */
  currentSector: string;
  currentCluster: string | null;
  clusters: UiStarCluster[];
  exits: UiStarExit[];
  /** Level 2: lanes between sectors (one per sector pair). Level 3: links between clusters. */
  sectorLinks: UiStarLink[];
  clusterLinks: UiStarLink[];
  /** The nebula backdrop around the player (levels 1 and 2). */
  nebula: UiNebulaTile[];
}

/** The hyperspace trip: the route's node ids, the index of the node last passed, and the hop's pace. */
export interface UiTravel {
  route: string[];
  at: number;
  /** 'hop': under way to route[at + 1]; 'arrived': at the end; 'noFuel': stopped for want of fuel. */
  phase: 'hop' | 'arrived' | 'noFuel';
  /** A drop was asked for: the route ends at the next node, where the ship drops out. */
  stopping: boolean;
  /** Fuel the next hop needs (when stopped for want of it). */
  need: number;
  /** The route's node names (Uncharted where not discovered), for views that do not hold the whole map. */
  names: string[];
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
  /** Total fuel of all hops (each is paid as it is entered), and the days of the whole route (data; the map counts turns, one per hop). */
  fuel: number;
  time: number;
  /** Per hop: the node reached, its fuel and its days. */
  legs: { to: string; fuel: number; time: number; kind: 'route' | 'hyperlane'; gate: boolean }[];
  /** FTL charge needed to enter hyperspace (the largest hop's, spent once), and whether the tank and the drive cover the route / the first hop. */
  nextCharge: number;
  fuelOk: boolean;
  chargeOk: boolean;
  /** Why the next jump cannot go now (a short sentence), or null. */
  blocker: string | null;
}

/** What a jump would leave behind or cut loose (the confirm step lists it). Names only: the ids of docked vehicles go in `withDocked`. */
export interface UiJumpWarnings {
  /** Living player crew not aboard (boarding parties, EVA, crew on a shuttle that is away). */
  crew: string[];
  /** Player vehicles not stowed or docked on the ship. */
  vehicles: string[];
  /** Non-player vehicles docked at the ship's airlocks; each can come along or be cut loose. */
  hostileDocked: { id: number; name: string }[];
}

/** The deploy picker's data while the ship waits to be placed. Sector tiles; `keepOut` rects are where the gap rule forbids the ship's top-left corner... see `others`. */
export interface UiDeploy {
  node: string;
  nodeName: string;
  width: number;
  height: number;
  /** The waiting ship's size and a spot that passes the gap rule (null when the sector has none). */
  ship: { w: number; h: number };
  suggested: { x: number; y: number } | null;
  /** Ships already in the sector: their bounding rect, the padded frame the gap rule keeps clear, and who they are. */
  others: { x: number; y: number; w: number; h: number; frame: { x: number; y: number; w: number; h: number }; name: string; hostile: boolean }[];
}
