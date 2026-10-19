/**
 * Starmap tuning. Units are map units (the starmap view draws one unit as one SVG pixel at zoom 1). See
 * docs/ARCHITECTURE.md, "Starmap", for what each value shapes.
 */

/** Sector sites: one candidate per global cell of this size, jittered anywhere inside it. */
export const SITE_CELL = 320;
/** Cells per chunk side: a chunk is CHUNK_CELLS x CHUNK_CELLS cells (1280 units). */
export const CHUNK_CELLS = 4;
/**
 * Macro structure (macro.ts): clusters on a coarse grid of MACRO_CELL cells (CLUSTER_CHANCE of cells hold one), joined
 * by corridors across the void. Radii are skewed towards small; stretch and wobble make the shapes irregular.
 */
export const MACRO_CELL = 3600;
export const CLUSTER_CHANCE = 0.8;
export const CLUSTER_RADIUS = { min: 800, max: 1900 } as const;
export const CLUSTER_STRETCH = { min: 1, max: 1.5 } as const;
export const CLUSTER_WOBBLE = 0.25;
/** Clusters closer than this may be linked: relative-neighbourhood links plus LINK_EXTRA of the other Gabriel links. */
export const LINK_MAX = 7600;
export const LINK_EXTRA = 0.45;
/** Chance a linked pair gets a second corridor (a second crossing, offset sideways). */
export const SECOND_CORRIDOR = 0.3;
/** Corridor density on its axis, fading to zero at CORRIDOR_WIDTH from it. */
export const CORRIDOR_DENSITY = 0.42;
export const CORRIDOR_WIDTH = 150;
/** Density at which a point belongs to its cluster (for territory and metrics). */
export const CLAIM_DENSITY = 0.25;

/**
 * Sector sites: one candidate per cell, alive with a chance rising from DENSITY_MIN to DENSITY_FULL density. Near a
 * corridor axis the candidate snaps onto it. Survivors are thinned so sites keep SITE_SPACING apart (core spacing at
 * density 1, void spacing at 0; a pair uses the mean of both).
 */
export const DENSITY_MIN = 0.12;
export const DENSITY_FULL = 0.35;
export const SITE_SPACING = { core: 360, void: 640 } as const;
/** Corridor snapping: candidates within this distance of an axis move onto it (plus a little sideways jitter). */
export const CORRIDOR_SNAP = 300;
/** Corridor stations (one sector each) every this many units along the axis. */
export const CORRIDOR_STEP = 580;
export const CORRIDOR_JITTER = 30;
/** Sector radius by density (core to void), +-15% at random, capped so neighbouring hulls keep HULL_GAP. */
export const SECTOR_RADIUS = { core: 160, void: 270 } as const;
export const HULL_GAP = 34;
/** Hull padding around the outer nodes (nodes stay inside radius - HULL_PAD). */
export const HULL_PAD = 16;

/** Nodes: Poisson-disk darts inside the sector disc. Count ~ density-scaled NODE_DENSITY x r^2, clamped. */
export const NODE_MIN_DIST = 40;
export const NODE_DENSITY = { core: 0.0011, void: 0.00025 } as const;
export const NODES_PER_SECTOR = { min: 8, max: 42 } as const;
/** Routes inside a sector: the spanning tree of the Gabriel graph plus this share of its other edges. */
export const ROUTE_EXTRA = 0.3;

/** Hyperlanes: sector pairs closer than this (site to site) may be linked. */
export const HYPERLANE_MAX = 1200;
/** A hyperlane may not cross void: no stretch longer than LANE_MAX_VOID with density below LANE_MIN_DENSITY. */
export const LANE_MIN_DENSITY = 0.06;
export const LANE_MAX_VOID = 260;
/** Relative-neighbourhood edges (the backbone, contains the spanning tree) plus this share of the other Gabriel edges. */
export const HYPERLANE_EXTRA = 0.3;
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
 * cluster centres, so whole clusters change hands; TERRITORY_SCALE scales cells and reaches (content reaches included).
 */
export const TERRITORY_CELL = 1100;
export const TERRITORY_REACH = 760;
export const TERRITORY_SCALE = 4.5;
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
export const FRONTIER_RING = 1;

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
