import type { ItemQty } from '../registry';
import type { FleetRole, ShipSize } from './defs';
import type { Vec } from './geometry';

export type { FleetRole, ShipSize } from './defs';

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
  /** Fleet ships only: the ship's name ("CNS Valiant") and size class (what its home port rebuilds when it is lost). */
  name?: string;
  size?: ShipSize;
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
  /** Its structures have been made real (populate.ts); once true they belong to the node's archive. */
  populated?: true;
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
  /**
   * 'hop': under way; 'arrived': at the end of the route; 'noFuel': stopped at `route[at]` for want of fuel for the next hop;
   * 'interdicted': halted at `route[at]` by a pending interdiction (resolved by `galaxy.respond`, the ship stays in hyperspace);
   * 'event': the ship is in an event grid (`GalaxyState.event`) and the trip waits.
   */
  phase: 'hop' | 'arrived' | 'noFuel' | 'interdicted' | 'event';
  /** Set in phase 'event': the phase to go back to when the grid is left ('interdicted' resumes the trip). */
  held?: 'hop' | 'arrived' | 'noFuel' | 'interdicted';
  /** A drop was asked for mid-hop: the route was cut after the hop under way and the ship drops out when it gets there. */
  stopping?: true;
}

/**
 * An NPC fleet (user decisions 2026-10-22: a living world). Fleets are created with their home port when its chunk is generated (roster.ts) and live
 * until every ship in them is destroyed; a lost ship is rebuilt by the port, slowly (ports.ts). They move on the starmap one hop per turn along an
 * agenda (agenda.ts), and the same ships become real ones in a node the player is in: `ships` are `Contact`s (the node-contact descriptor),
 * `Contact.ship` is set while the fleet is materialised in the player's active node and unset (descriptors only) everywhere else. A fleet is
 * never in a node archive: its ships are lifted out when the player leaves.
 */
export interface Fleet {
  id: number;
  faction: string;
  role: FleetRole;
  ships: Contact[];
  /** Its home port (`<node id>#<structure index>`, ports.ts). */
  home: string;
  /** The node it is at (or has just reached this turn). */
  node: string;
  /** The node it was at before this turn's move; equals `node` when it did not move. */
  from: string;
  /** The turn of its last move (-1 never). */
  moved: number;
  /** Nodes still to visit, the next first. Empty = at its destination. */
  route: string[];
  /** Where it is heading (last of the route, or `node`). */
  dest: string;
  /** Turns left idle (resting at home, working at a destination) before it plans its next leg; while stranded, turns left to repair. */
  dwell: number;
  /** Stops left on this outing before it heads home (0 = going home, or at home). */
  legs: number;
  /** The turn its agenda has been played up to. Fleets away from the player are not stepped; `catchUp` plays them forward on approach. */
  synced: number;
  /** Stranded (broke down, or badly damaged in a fight): it does not move and calls for help until it is repaired (`dwell` turns) or helped. */
  damaged?: true;
  /** Turn of its last encounter with the player (a cooldown against repeats). */
  met?: number;
  /** What it carries (traders and miners; market.ts, dock.ts): plain item counts, capped by its hulls (`CARGO_BY_SIZE`). */
  cargo?: ItemQty[];
  /** The node a trader bought its cargo for: its next stop, if that is still a valid stop (agenda.ts). */
  pick?: string;
}

/**
 * A port's market where it differs from the world's: `stock` holds the items whose level is not the port's baseline (market.ts `baselineOf`), as of
 * `turn`; everything else sits at the baseline. No entry = baseline at turn 0. Ports in the player's live node keep their stock on the station's
 * trader instead (`Trader.port`) and the entry waits until the player leaves.
 */
export interface MarketState {
  turn: number;
  stock: Record<string, number>;
}

/** A port that lost ships: the replacements it owes (in build order) and the turn the first is done; one is built every `PortKindDef.rebuildTurns`. */
export interface PortState {
  queue: { faction: string; role: FleetRole; size: ShipSize }[];
  next: number;
  /** Ships built here so far (keeps replacement seeds apart). */
  built: number;
}

/** What a crossing with a fleet turns into. 'interdict' halts the player's travel; the others are alerts for now. */
export type EncounterKind = 'interdict' | 'hail' | 'scan' | 'distress';
/** How the player and the fleet met in a turn: opposite directions on one lane, the same direction on one lane, or ending in the same node. */
export type CrossingHow = 'pass' | 'overlap' | 'node';

/**
 * An encounter waiting to be resolved (slice (c): evade, bribe or fight on a deep-space event grid). Stored when a crossing is
 * detected; it expires at turn `expires` if nothing resolved it. Fleet facts are copied: the fleet may be gone by then.
 */
export interface Encounter {
  id: number;
  kind: EncounterKind;
  fleet: number;
  faction: string;
  role: FleetRole;
  /** The fleet's display name (its first ship, "+n" for the rest). */
  name: string;
  ships: number;
  /** Fleet strength (`fleetStrength`) and the node's danger when it was met: the odds and the bribe are computed from these. */
  strength: number;
  danger: number;
  how: CrossingHow;
  /** The node the player was at when it happened (where travel halts for an interdiction). */
  node: string;
  turn: number;
  expires: number;
}

/** What the player does about an encounter (`galaxy.respond`): interdictions take evade / bribe / fight, a distress call respond / ignore, hails and scans acknowledge. */
export type EncounterChoice = 'evade' | 'bribe' | 'fight' | 'respond' | 'ignore' | 'acknowledge';

/**
 * A deep-space pocket (node id `event:<encounter id>`, never in the galaxy index, never archived) the player's packet was deployed into
 * to settle an encounter. The fleet is out of `GalaxyState.fleets` while the grid exists. Leaving it discards the sector.
 */
export interface EventGrid {
  /** The encounter id; the grid's node id is `eventNodeId(id)`. */
  id: number;
  /** 'fight': an interdiction (the fleet is hostile); 'rescue': a distress call (the fleet's ships are neutral). */
  kind: 'fight' | 'rescue';
  encounter: Encounter;
  /** The fleet while inside the grid (its ships are real ones here). */
  fleet: Fleet;
  /** Its ships that escaped from the grid (jumped away); they rejoin the fleet when the grid is left. */
  fled: Contact[];
}

/** How the last encounter ended, for the view's outcome line (`GalaxyState.lastResult`). `odds` and `roll` for an evade, `cost` for a bribe. */
export interface EncounterResult {
  id: number;
  kind: EncounterKind;
  faction: string;
  role: FleetRole;
  /** 'evaded' | 'evadeFailed' | 'bribed' | 'fought' | 'cleared' | 'escaped' | 'left' | 'responded' | 'helped' | 'acknowledged' | 'ignored' | 'gone' | 'expired'. */
  outcome: string;
  turn: number;
  odds?: number;
  roll?: number;
  cost?: number;
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
  /** The starmap turn: one per hop entered, and one per TURN_SEC of game time at a node (see turn.ts). */
  turn: number;
  /** Ticks of active game time since the last turn (reset by a hop's turn and at `sector.deploy`). */
  turnClock: number;
  /** NPC fleets on the map, ascending id (fleets.ts). */
  fleets: Fleet[];
  /** Encounters waiting to be resolved, ascending id (encounters.ts). */
  encounters: Encounter[];
  /** The event grid the player is in, or null (eventGrid.ts). `sim.sector.node` is its node id while it exists; `current` stays the real node. */
  event: EventGrid | null;
  /** How the last encounter was settled, or null. */
  lastResult: EncounterResult | null;
  /** Ids for fleets, their ships and encounters (apart from `nextId`, so node contacts keep their ids). */
  nextFleet: number;
  /** Ports that owe replacement ships, by port id (ports.ts). Ports with nothing owed have no entry. */
  ports: Record<string, PortState>;
  /** Port markets that differ from their baseline, by port id (market.ts). */
  markets: Record<string, MarketState>;
  /** Travel days spent in jumps. */
  days: number;
  /** The hyperspace trip in progress, or null. */
  travel: Travel | null;
  /** The story draw owed at the next `sector.deploy` ('transit' after an anchored hyperlane), or null. */
  pendingDraw: 'arrival' | 'transit' | null;
  /** Bumped on every change the starmap view shows. */
  rev: number;
}
