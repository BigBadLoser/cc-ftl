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
  /** The region (province) it belongs to: `g.<rx>.<ry>`. */
  region?: string;
  /** Its region's hub: the crossroads sector (more nodes, more lanes). */
  hub?: true;
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
  /** A hyperlane crossing a region border (one of the few gates between two regions). */
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

/** A ship at a node. Hostile ones are spawned into the sector grid on arrival (`ship` = its ShipC entity once spawned). */
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
  contacts: Contact[];
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
  /** Travel days spent in jumps. */
  days: number;
  /** Bumped on every change the starmap view shows. */
  rev: number;
}
