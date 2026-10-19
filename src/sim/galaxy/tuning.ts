/**
 * Starmap tuning. Units are map units (the starmap view draws one unit as one SVG pixel at zoom 1). See
 * docs/ARCHITECTURE.md, "Starmap", for what each value shapes.
 */

/** Sector sites: one candidate per global cell of this size, jittered anywhere inside it. */
export const SITE_CELL = 320;
/** Cells per chunk side: a chunk is CHUNK_CELLS x CHUNK_CELLS cells (1280 units). */
export const CHUNK_CELLS = 4;
/** Matérn thinning: a candidate survives only if no higher-priority candidate lies within this distance. */
export const SITE_MIN_DIST = 230;
/** Relaxation: neighbours within this distance push a site apart, at most SITE_MAX_SHIFT units. */
export const RELAX_RANGE = 380;
export const RELAX_STEP = 0.35;
export const SITE_MAX_SHIFT = 60;
/** Sector radius range; the radius is also capped so neighbouring hulls keep HULL_GAP between them. */
export const SECTOR_RADIUS = { min: 95, max: 150 } as const;
export const HULL_GAP = 34;
/** Hull padding around the outer nodes (nodes stay inside radius - HULL_PAD). */
export const HULL_PAD = 16;

/** Nodes: Poisson-disk darts inside the sector disc. Count ~ NODE_DENSITY x r^2, clamped. */
export const NODE_MIN_DIST = 40;
export const NODE_DENSITY = 0.00062;
export const NODES_PER_SECTOR = { min: 5, max: 14 } as const;
/** Routes inside a sector: the spanning tree of the Gabriel graph plus this share of its other edges. */
export const ROUTE_EXTRA = 0.3;

/** Hyperlanes: sector pairs closer than this (site to site) may be linked. */
export const HYPERLANE_MAX = 1500;
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

/** Territory: one faction seed per cell of this size; a sector belongs to the nearest seed within its reach. */
export const TERRITORY_CELL = 1100;
export const TERRITORY_REACH = 760;
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

/** Density field: fractal noise with features about DENSITY_SCALE units across. Below DENSITY_VOID a candidate site
 * survives with DENSITY_FLOOR chance (sparse stepping stones), above DENSITY_CORE always. */
export const DENSITY_SCALE = 2600;
export const DENSITY_OCTAVES = 3;
export const DENSITY_VOID = 0.4;
export const DENSITY_CORE = 0.58;
export const DENSITY_FLOOR = 0.1;
/** Radius around the start that is lifted towards core density. */
export const DENSITY_HOME = 1400;
