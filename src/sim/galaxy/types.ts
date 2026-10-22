import type { Vec } from './geometry';

/**
 * The starmap model. Terms (user decision): a **node** is one playable location (older code says "sector" for it); a
 * **sector** is a group of nodes; sectors are joined by **hyperlanes**. Everything generated (`ChunkData`) is a pure
 * function of (seed, content, chunk); the mutable state is `GalaxyState` minus `chunks`.
 */

/** A structure at a node: its StructureDef id and the faction that owns it (null = nobody, e.g. a derelict). */
export interface StructureRef {
  def: string;
  owner: string | null;
}

/** A ship present at a node when the galaxy was generated (galaxy faction, generator seed, depth). */
export interface ContactSeed {
  faction: string;
  seed: number;
  depth: number;
}

export interface NodeData {
  /** `<sector id>.n<k>`; n0 of the start sector is the start node. */
  id: string;
  sector: string;
  x: number;
  y: number;
  name: string;
  danger: number;
  /** Territory (the sector's faction); null = open space. */
  faction: string | null;
  structures: StructureRef[];
  /** Item ids the node can supply (from its structures). */
  resources: string[];
  contacts: ContactSeed[];
}

export interface SectorData {
  /** `s.<gx>.<gy>`: the global site cell it grew from. */
  id: string;
  chunk: string;
  x: number;
  y: number;
  /** Radius of the disc the nodes (plus padding) lie in. */
  r: number;
  name: string;
  faction: string | null;
  danger: number;
  nodes: string[];
  /** Padded convex hull of the nodes, counter-clockwise. */
  hull: Vec[];
  /** The cluster (province) it belongs to: `g.<rx>.<ry>`. */
  cluster?: string;
  /** Its cluster's hub: the crossroads sector (more nodes, more lanes). */
  hub?: true;
  /** The layout style its nodes were shaped by (layout.ts). */
  layout?: string;
  /** The body at its centre (its landmark): kind, position and drawn radius. */
  body?: { kind: string; x: number; y: number; r: number };
  /** Its cluster's name and type (what to expect there: core, trade, pirate, frontier...). */
  clusterName?: string;
  clusterType?: string;
}

export type EdgeKind = 'route' | 'hyperlane';

/** A jump: a route inside a sector or a hyperlane between two sectors' gateway nodes. Undirected; a < b. */
export interface EdgeData {
  /** `r:<a>|<b>` or `h:<sector a>|<sector b>`. */
  id: string;
  a: string;
  b: string;
  kind: EdgeKind;
  length: number;
  /** Fuel units, FTL charge seconds and travel days. */
  fuel: number;
  charge: number;
  time: number;
  /** A mid-lane anchor: crossing draws from the story's 'transit' pool. */
  anchor?: true;
  /** A hyperlane crossing a cluster border (one of the few gates between two clusters). */
  gate?: true;
  /** A long jump across the void (a rift lane). */
  rift?: true;
}

export interface ChunkData {
  /** `<cx>,<cy>`. */
  key: string;
  cx: number;
  cy: number;
  /** Sectors whose site lies in this chunk, and their nodes and routes. */
  sectors: SectorData[];
  nodes: NodeData[];
  /** Routes of its sectors plus every hyperlane touching one of them (shared hyperlanes appear in both chunks, identical). */
  edges: EdgeData[];
}

/** A ship at a node (`ship` = its ShipC entity once materialised in the sector). */
export interface Contact {
  id: number;
  faction: string;
  /** Generator faction (content.factions id). */
  shipgen: string;
  seed: number;
  depth: number;
  ship?: number;
  /** Tick it turned up (0 for ships there from the start). */
  since: number;
}

export interface NodeState {
  /**
   * Ships at the node that are not in its archive: its generated contacts until the player first enters (then they are
   * materialised as real ships and the archive owns them: this list is emptied when the node is left), and arrivals while the
   * player stays.
   */
  contacts: Contact[];
  /** The player has entered this node: its generated contacts have become ships (owned by the node's archive once left). */
  entered: boolean;
}

/**
 * Hyperspace travel of the player's ship along a route (`sector.state === 'hyperspace'`, the ship waits as the sector's packet).
 * `route[0]` is the node it left; `at` is the index of the node last passed (`galaxy.current` is `route[at]`).
 */
export interface Travel {
  route: string[];
  /** FTL charge seconds paid on entering hyperspace (the largest any hop of the route needs). */
  charge: number;
  at: number;
  /** Ticks into the hop from `route[at]` to `route[at + 1]`, and how many it takes (the edge's days at HYPERSPACE_SEC_PER_DAY). */
  elapsed: number;
  hopTicks: number;
  /** 'hop': under way; 'arrived': at the end of the route; 'noFuel': stopped at `route[at]` for want of fuel for the next hop. */
  phase: 'hop' | 'arrived' | 'noFuel';
  /** A drop was asked for mid-hop: the route was cut after the hop under way and the ship drops out when it gets there. */
  stopping?: true;
}

/** Mutable starmap state on the Sim (`sim.galaxy`), saved with the game. */
export interface GalaxyState {
  current: string;
  /** Generated chunks by key. Saved as keys only and rebuilt from the seed on load. */
  chunks: Record<string, ChunkData>;
  /** Node id -> tick it was first seen by sensors / first visited. */
  discovered: Record<string, number>;
  visited: Record<string, number>;
  /** Per-node changes (contacts), created on first visit or arrival. */
  nodes: Record<string, NodeState>;
  /** Own Rng state (arrival rolls), so the galaxy never disturbs `sim.rng`. */
  rng: number;
  /** Tick of the next arrival roll at the current node. */
  nextArrival: number;
  nextId: number;
  jumps: number;
  /** The starmap turn: one per hop entered (see turn.ts). */
  turn: number;
  /** Travel days spent in jumps. */
  days: number;
  /** The hyperspace trip in progress, or null. */
  travel: Travel | null;
  /** The story draw owed at the next `sector.deploy` ('transit' after an anchored hyperlane), or null. */
  pendingDraw: 'arrival' | 'transit' | null;
  /** Bumped on every change the starmap view shows. */
  rev: number;
}
