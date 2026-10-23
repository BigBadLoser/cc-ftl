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

/** A port's market in a few words: the goods that are cheap and the goods that are dear there right now. */
export interface UiStarMarket {
  cheap: string[];
  dear: string[];
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
  /** The market of its trading port, when sensors reach it and it has one. */
  market?: UiStarMarket | null;
}

/** An NPC fleet the sensors can see: drawn beside its node, heading for `next` (null while resting). */
export interface UiStarFleet {
  id: number;
  node: string;
  x: number;
  y: number;
  /** The next node on its route (position), or null when it rests or is stranded. */
  tx: number | null;
  ty: number | null;
  /** The fleet's name (its first ship, "+n" for the rest), e.g. "CNS Valiant +1". */
  name: string;
  /** Faction name, role label ("Trader", "Patrol", "Raider"), ship count, tone by faction kind, and whether it is hostile to the player. */
  faction: string;
  role: string;
  ships: number;
  tone: Tone;
  hostile: boolean;
  damaged: boolean;
  /** What it is doing: "Resting at X", "Trading run to X", "Returning home to X", "Adrift"... */
  heading: string;
  /** Its home port's node. */
  home: string;
  /** What it carries ("20 Metal, 4 Ice"), or empty. */
  cargo?: string;
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

/** One line of the news feed (what the world did lately): precise inside sensor range, a rumour outside it. */
export interface UiNews {
  id: number;
  turn: number;
  icon: 'skull' | 'evasion' | 'combat' | 'trade' | 'stock' | 'ship';
  tone: Tone;
  text: string;
  /** Where: the node's name for news in range, the region (sector) for a rumour. */
  place: string;
  rumour: boolean;
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
  /** NPC fleets within sensor range. */
  fleets: UiStarFleet[];
  /** The news feed, newest first. */
  news: UiNews[];
  /** The player's credits (what a bribe costs is compared to this), pending encounters, the event grid and how the last encounter ended. */
  credits: number;
  encounters: UiEncounter[];
  event: UiEventGrid | null;
  result: UiEncounterResult | null;
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

/** One thing the player can do about an encounter. `detail` is the odds or the price ("62%", "84 cr"), `why` the reason when it is disabled. */
export interface UiEncounterChoice {
  choice: 'evade' | 'bribe' | 'fight' | 'respond' | 'ignore' | 'acknowledge';
  label: string;
  detail: string;
  enabled: boolean;
  why: string | null;
}

/** A pending encounter as the drawer shows it: who, how strong, how it came about and the choices. */
export interface UiEncounter {
  id: number;
  kind: 'interdict' | 'hail' | 'scan' | 'distress';
  title: string;
  /** The fleet's name ("Rust Jackal +1"), then its faction and role label. */
  name: string;
  faction: string;
  role: string;
  tone: Tone;
  hostile: boolean;
  ships: number;
  /** "Light" | "Moderate" | "Heavy" | "Overwhelming", from the fleet strength. */
  threat: string;
  /** "Intercepted you on the lane" etc., and the node name. */
  how: string;
  node: string;
  choices: UiEncounterChoice[];
}

/** How the last encounter ended, as a line with a tone. */
export interface UiEncounterResult {
  text: string;
  /** The starmap turn it happened. */
  turn: number;
  tone: 'green' | 'amber' | 'red' | 'dim';
}

/** The event grid the player is in (a deep-space pocket for a fight or a rescue). */
export interface UiEventGrid {
  id: number;
  kind: 'fight' | 'rescue';
  title: string;
  faction: string;
  role: string;
  tone: Tone;
  /** Fleet ships still in the grid, and how many of them are hostile and active. */
  ships: number;
  hostiles: number;
  /** The ship is still being placed (the deploy picker is up). */
  deploying: boolean;
  /** Leaving is allowed now; `why` says what is missing when it is not. Under fire leaving is a flee that spends the charged drive. */
  canLeave: boolean;
  why: string | null;
  fleeing: boolean;
  /** The destination of the held trip (node name) and the hops left. */
  resumeTo: string;
  hopsLeft: number;
}

/** The hyperspace trip: the route's node ids, the index of the node last passed, and the hop's pace. */
export interface UiTravel {
  route: string[];
  at: number;
  /** 'hop': under way to route[at + 1]; 'arrived': at the end; 'noFuel': stopped for want of fuel; 'interdicted': halted by an encounter; 'event': in an event grid. */
  phase: 'hop' | 'arrived' | 'noFuel' | 'interdicted' | 'event';
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
  /** Fuel units missing for the whole route (0 when the stock covers it). */
  fuelShort: number;
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
