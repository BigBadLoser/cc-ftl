/**
 * Starmap tuning. Units are map units (the starmap view draws one unit as one SVG pixel at zoom 1). See
 * docs/ARCHITECTURE.md, "Starmap", for what each value shapes.
 */

/**
 * Version of the galaxy generator and its content tables (names, factions, structures). The save lists chunks by key and
 * regenerates them from the seed, so it must change whenever any of that changes the output; a save of another version is refused.
 */
export const GENERATOR_VERSION = 1;

/** Sector sites: one candidate per global cell of this size, jittered anywhere inside it. */
export const SITE_CELL = 320;
/** Cells per chunk side: a chunk is CHUNK_CELLS x CHUNK_CELLS cells (1280 units). */
export const CHUNK_CELLS = 4;
/**
 * Terrain (terrain.ts): noise features are about TERRAIN_SCALE units across. Density is cached on a fine lattice for site
 * placement and a coarse one for void checks along lines.
 */
export const TERRAIN_SCALE = 5200;
export const TERRAIN_LATTICE = 40;
export const TERRAIN_COARSE = 160;
/** The slowly varying terrain parts (domain warp, flow, tide) are cached on this coarser lattice. */
export const TERRAIN_LOW = 400;
/** Directional terrain: filament noise is averaged over +-2 steps of this length (in noise units) along the flow. */
export const TERRAIN_STREAK = 0.09;
/** The large-scale tide (dense core expanses vs sparse rim) has features about this many units across. */
export const TERRAIN_TIDE_SCALE = 26000;

/**
 * Clusters (clusters.ts): one seed candidate per CLUSTER_CELL cell on ground at least CLUSTER_SEED_DENSITY dense, thinned
 * so seeds keep their mean CLUSTER_SPACING apart (skewed small, so a few clusters are large). A sector joins the
 * seed cheapest to reach within CLUSTER_REACH: distance (wobbled by +-CLUSTER_BORDER_WOBBLE) plus CLUSTER_RIFT_COST per
 * unit of void crossed.
 */
export const CLUSTER_CELL = 1800;
export const CLUSTER_SPACING = { min: 1600, max: 3800 } as const;
export const CLUSTER_REACH = 5600;
export const CLUSTER_SEED_DENSITY = 0.35;
export const CLUSTER_BORDER_WOBBLE = 0.2;
export const CLUSTER_RIFT_COST = 14;
/** Clusters smaller than this are absorbed by their neighbours. */
export const MIN_CLUSTER_SECTORS = 4;
/** Cluster borders are left empty where a site's reach-cost margin to the next cluster is under this (spaces clusters apart). */
export const BORDER_GAP = 700;
/** Wild space: sectors a cluster reaches only over more than WILD_VOID of void, or with fewer than WILD_MATES cluster-mates within WILD_GAP. */
export const WILD_VOID = 300;
export const WILD_GAP = 1150;
export const WILD_MATES = 2;
/**
 * Gates: neighbouring clusters keep 1 crossing lane, plus a second and third with these chances, picked shortest first
 * and at least GATE_SPREAD apart. A border with a detour through a third cluster closes with NO_GATE chance.
 */
export const GATE_SECOND = 0.45;
export const GATE_THIRD = 0.12;
export const GATE_SPREAD = 900;
export const NO_GATE = 0.5;
/** Crossing a gate costs this much extra fuel and this many times the travel days. */
export const GATE_FUEL = 2;
export const GATE_TIME = 2;

/**
 * Sector sites: one candidate per cell, alive with a chance rising from DENSITY_MIN to DENSITY_FULL density. Survivors
 * are thinned so sites keep SITE_SPACING apart (core spacing at
 * density 1, void spacing at 0; a pair uses the mean of both).
 */
export const DENSITY_MIN = 0.12;
export const DENSITY_FULL = 0.35;
export const SITE_SPACING = { core: 360, void: 640 } as const;
/** Sector radius by density (core to void), +-15% at random, capped so neighbouring hulls keep HULL_GAP. */
export const SECTOR_RADIUS = { core: 160, void: 270 } as const;
export const HULL_GAP = 34;
/** Hull padding around the outer nodes (nodes stay inside radius - HULL_PAD). */
export const HULL_PAD = 16;

/**
 * Nodes: Poisson-disk darts inside the sector disc, shaped by the sector's layout style (layout.ts). 6-12 per sector;
 * spacing is NODE_SPACING x inner radius / sqrt(count), never below NODE_MIN_DIST.
 */
export const NODE_MIN_DIST = 64;
export const NODE_SPACING = 1.25;
export const NODES_PER_SECTOR = { min: 6, max: 12 } as const;
/** Layout style weights (a hub is always 'spokes', the start sector a 'cloud'), and the looseness blended into a style. */
export const LAYOUT_WEIGHTS = { cloud: 3, streak: 2, clumps: 1.5, ring: 1, fork: 1.5, corridor: 1 } as const;
export const LAYOUT_LOOSENESS = { min: 0.08, max: 0.4 } as const;
/** Central bodies (layout.ts), by weight. */
export const BODY_WEIGHTS = { star: 5, red_dwarf: 3, blue_giant: 1, gas_giant: 2, nebula: 1.5, black_hole: 0.5 } as const;
/** Routes inside a sector: the spanning tree of the Gabriel graph plus this share of its other edges. */
export const ROUTE_EXTRA = 0.15;

/** Hyperlanes: sector pairs closer than this (site to site) may be linked. */
export const HYPERLANE_MAX = 1200;
/** A hyperlane may not cross void: no stretch longer than LANE_MAX_VOID with density below LANE_MIN_DENSITY. */
export const LANE_MIN_DENSITY = 0.05;
export const LANE_MAX_VOID = 380;
/** Rift lanes: relative-neighbour pairs up to this far apart may cross the void (so no island is stranded). */
export const RIFT_MAX = 2800;
/** Gate picking treats a rift lane as this much longer, so clear crossings win. */
export const RIFT_GATE_PENALTY = 2000;
/** Inside a cluster: a local spanning tree of the backbone plus this share of the other backbone links (loops). */
export const LOOP_CHANCE = 0.2;
/** Chance a hyperlane carries a mid-lane event anchor. */
export const ANCHOR_CHANCE = 0.35;

/** Fuel per jump: ceil(length / units per fuel). Hyperlanes are cheaper per distance. */
export const ROUTE_UNITS_PER_FUEL = 90;
export const HYPERLANE_UNITS_PER_FUEL = 220;
/** FTL charge seconds per jump: routes scale with length (capped below a full charge); a hyperlane needs a full charge. */
export const ROUTE_CHARGE = { base: 10, perUnit: 0.12, max: 30 } as const;
/** Travel days per unit (tie-breaker for routes, shown in the preview). */
export const ROUTE_DAYS_PER_UNIT = 1 / 40;
export const HYPERLANE_DAYS_PER_UNIT = 1 / 110;

/** Danger tier = floor(distance from the start / DANGER_STEP), at most DANGER_MAX. */
export const DANGER_STEP = 650;
export const DANGER_MAX = 9;

/**
 * Territory: one faction seed per cell of this size; a point belongs to the nearest seed within its reach. Read at
 * cluster seeds, so whole clusters change hands; TERRITORY_SCALE scales cells and reaches (content reaches included).
 */
export const TERRITORY_CELL = 1100;
export const TERRITORY_REACH = 760;
export const TERRITORY_SCALE = 3;
/** Extra reach on top of TERRITORY_SCALE, so less space between the powers is left unclaimed. */
export const TERRITORY_REACH_BOOST = 1.35;
/** Chance a sector with no territory still has a (free traders') station. */
export const OPEN_STATION_CHANCE = 0.3;

/** Ships present at generation: chance per node = CONTACT_PER_DANGER x danger, capped. */
export const CONTACT_PER_DANGER = 0.06;
export const CONTACT_MAX_CHANCE = 0.5;
/** Extra weight the territory owner gets when picking who a ship belongs to. */
export const TERRITORY_TRAFFIC = 3;

/** Sensor range in jumps from the current node. */
export const SENSOR_HOPS = 3;
/** Chunks within this ring of the current node's chunk are generated on arrival (lazy frontier). */
export const FRONTIER_RING = 2;

/** Arrival rolls while the player stays at a node: every ARRIVAL_EVERY_SEC, chance ARRIVAL_PER_DANGER x danger (x territory). */
export const ARRIVAL_EVERY_SEC = 60;
export const ARRIVAL_PER_DANGER = 0.05;
export const ARRIVAL_MAX_CHANCE = 0.45;
/** Multipliers on the arrival chance in hostile and friendly territory. */
export const ARRIVAL_HOSTILE_TERRITORY = 1.5;
export const ARRIVAL_FRIENDLY_TERRITORY = 0.4;
/** No more arrivals while this many hostile contacts are at the node. */
export const MAX_HOSTILE_CONTACTS = 2;

/** Standings: reputation spills over to related factions by relation x this; tiers at these thresholds. */
export const STANDING_SPILLOVER = 0.25;
export const HOSTILE_BELOW = -2;
export const FRIENDLY_AT = 3;
