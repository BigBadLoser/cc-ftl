import type { FleetRole } from './defs';

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

/**
 * The starmap is turn-based: entering a hop is one turn (`GalaxyState.turn`), whatever the edge's days (kept as data). The sim steps
 * one hop per TURN_TICKS ticks only as pacing, so the map's glide animation (a fixed tween per hop, visual only) can play between nodes.
 */
export const TURN_TICKS = 16;
/** Game time also makes turns: one per TURN_SEC seconds the sector is active (3 minutes minimum; see turn.ts). Independent of ARRIVAL_EVERY_SEC. */
export const TURN_SEC = 180;

/**
 * NPC fleets (user decisions 2026-10-22: a persistent, living population). Every ship belongs to a home port and lives until destroyed (roster.ts);
 * the fleets of a region are created with its chunk. Only fleets whose current node or home is within FLEET_AREA_HOPS jumps of the player's node
 * are stepped each turn (fleets.ts); the others are frozen and `catchUp` (agenda.ts) plays them forward when the player comes near.
 */
export const FLEET_AREA_HOPS = 9;
/** Hops explored (and cached) from a node when fleets choose a target or a path; no leg of an outing may exceed it. */
export const REACH_HOPS = 8;
/** Turns a returning fleet rests at home before its next outing, and how long it works at a stop (by role). */
export const FLEET_REST = { min: 2, max: 8 } as const;
export const FLEET_WORK: Record<FleetRole, { readonly min: number; readonly max: number }> = {
  trader: { min: 2, max: 4 }, miner: { min: 3, max: 5 }, patrol: { min: 1, max: 3 }, pirate: { min: 1, max: 3 }, raider: { min: 1, max: 2 },
};
/** Stops on an outing before heading home, by role (a miner works one field; a patrol visits several territory nodes). */
export const FLEET_LEGS: Record<FleetRole, { readonly min: number; readonly max: number }> = {
  trader: { min: 1, max: 3 }, miner: { min: 1, max: 1 }, patrol: { min: 2, max: 4 }, pirate: { min: 1, max: 3 }, raider: { min: 1, max: 2 },
};
/** How far from its home port (hops) a role roams: a trader's stations, a miner's fields, a patrol's territory, a pirate's lanes. */
export const FLEET_RANGE: Record<FleetRole, number> = { trader: 6, miner: 4, patrol: 5, pirate: 5, raider: 5 };
/** The longest single leg (hops) of an outing. */
export const FLEET_LEG_HOPS = 5;
/** Chance per hop away from home that a fleet breaks down (stranded, calling for help) and the turns it takes to repair itself. */
export const BREAKDOWN_CHANCE = 0.0015;
export const REPAIR_TURNS = { min: 12, max: 24 } as const;
/** A ship that fights on at under this integrity (or is disabled) leaves its fleet stranded as well. */
export const STRANDED_INTEGRITY = 0.4;
/**
 * A fleet that was frozen is played forward turn by turn (exactly as if it had been stepped) for up to CATCHUP_MAX turns. After a longer
 * absence it is put back at its home port with a hashed rest and only the last CATCHUP_MAX turns are played: its place in its cycle differs
 * from a turn-by-turn run, but it is deterministic and valid.
 */
export const CATCHUP_MAX = 40;
/** Groups seeded at a start: a fleet created at game start rests up to this many turns before its first outing. */
export const FLEET_START_REST = 10;
/** Weight of the free traders' trader group at a market, against the owner's own groups (a navy trade station still has merchants docked). */
export const TRADE_GUESTS = 3;
/** Tries at finding a generator seed whose hull family is the size class a roster slot asked for. */
export const SEED_TRIES = 48;
/**
 * Story events (storyHop.ts): the chance a finished hop draws one, and on a lane with a mid-lane anchor. Before, every trip drew one on arrival
 * (certain) plus a timed draw about every 3 minutes wherever the ship sat; now only hops draw: one in five plain hops, one in two anchored lanes
 * (user, 2026-10-24: 50% per hop was too often; a 3-hop trip averages 0.6 events).
 */
export const STORY_HOP_CHANCE = 0.2;
export const STORY_ANCHOR_CHANCE = 0.5;
/** Chance a non-hostile fleet crossing the player produces a hail or scan (distress always offers help; hostile interdictions always happen). */
export const PASSING_ENCOUNTER_CHANCE = 0.12;
/** At most this many ships other than the player's are in a live node when a fleet's ships materialise (the sector is small; the rest wait as descriptors). */
export const FLEET_NODE_SHIPS = 3;
/** Fleets this many jumps from the player's node (or routed to it) have their ship generated ahead of arrival (fleetShips.ts `warmFleets`). */
export const WARM_HOPS = 2;
/** Turns before the same fleet can meet the player again, and before an unresolved encounter expires (interdictions last longer). */
export const ENCOUNTER_COOLDOWN = 6;
export const ENCOUNTER_TTL = { alert: 3, interdict: 6 } as const;
export const ENCOUNTER_MAX = 8;
/**
 * Encounter odds and prices (encounterOdds.ts). Fleet strength = sum over its ships of (1 + depth x STRENGTH_PER_DEPTH).
 * Bribe = BRIBE_PER_STRENGTH x strength x (1 + danger x BRIBE_PER_DANGER) x a standing factor (1 - BRIBE_STANDING x standing, clamped to [0.5, 2]), at least BRIBE_MIN.
 *
 * Evade odds are driven mainly by the pilot at the helm:
 *   pilot  = clamp(piloting skill / EVADE_TOP_SKILL, 0, 1)
 *   engine = clamp(raw engine evasion / EVADE_ENGINES_FULL, 0, 1)   (raw = the ship's evasion / (1 + SKILL_STEP x skill): powered, intact engines)
 *   odds   = (EVADE_PILOT_BASE + EVADE_PILOT_SPAN x pilot) x (EVADE_ENGINE_FLOOR + (1 - EVADE_ENGINE_FLOOR) x engine) - strength x EVADE_PER_STRENGTH
 * clamped to [EVADE_MIN, EVADE_MAX]; no pilot at an intact, powered helm, or no powered engines (ship evasion 0) gives EVADE_MIN.
 * Odds with one engine (strength: light 1.5, moderate 3.5, heavy 7, overwhelming 12): top pilot (skill 5) 0.85 / 0.79 / 0.68 / 0.53, skill 3 (a pilot role)
 * 0.62 / 0.56 / 0.45 / 0.30, a novice (skill 0.5) 0.33 / 0.27 / 0.17 / 0.05. Under way nobody mans the helm (consoles are only manned in combat), so the best pilot aboard flies it.
 */
export const STRENGTH_PER_DEPTH = 0.5;
export const BRIBE_PER_STRENGTH = 12;
export const BRIBE_PER_DANGER = 0.4;
export const BRIBE_STANDING = 0.05;
export const BRIBE_MIN = 10;
export const EVADE_TOP_SKILL = 5;
export const EVADE_ENGINES_FULL = 0.12;
export const EVADE_PILOT_BASE = 0.32;
export const EVADE_PILOT_SPAN = 0.57;
export const EVADE_ENGINE_FLOOR = 0.6;
export const EVADE_PER_STRENGTH = 0.03;
export const EVADE_MIN = 0.05;
export const EVADE_MAX = 0.9;
/** Reputation a rescued distress fleet gives (on its faction's key). */
export const RESCUE_REPUTATION = 2;

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
export const FRONTIER_RING = 1;

/** Arrival rolls while the player stays at a node: every ARRIVAL_EVERY_SEC, chance ARRIVAL_PER_DANGER x danger (x territory). */
/** Opening grace (grace.ts): no unprompted hostile arrival at a danger-0 node for this many seconds of game time... */
export const GRACE_SEC = 20 * 60;
/** ...or until the goal chain is past this act index (0 = the first act, "Get underway", is done), whichever comes first. */
export const GRACE_ACT = 0;
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

/**
 * The NPC economy (market.ts). A port's stock of an item moves toward `level = baseline + net / MARKET_DRIFT` by the fraction MARKET_DRIFT of the gap every turn
 * (net = production - consumption per turn), clamped to [0, cap]; a trade is an impulse on top. So with nobody trading, a market settles on its level and
 * returns to it after a shock (half-life about 17 turns). cap = max(MARKET_CAP_MIN, MARKET_CAP_MULT x baseline).
 */
export const MARKET_DRIFT = 0.04;
export const MARKET_CAP_MIN = 40;
export const MARKET_CAP_MULT = 3;
/** A consumed good's baseline is at least this many turns of its consumption (so a port that eats a good wants it). */
export const MARKET_WANT_TURNS = 20;
/** Deviations smaller than this from the baseline are not stored. */
export const MARKET_EPS = 0.05;
/** Units one hull of a size class hauls. */
export const CARGO_BY_SIZE = { small: 20, medium: 40, heavy: 80 } as const;
/** A trader only buys a good for the next stop when the price there beats the price here by this fraction, and takes at most this share of the stock. */
export const TRADE_MIN_MARGIN = 0.15;
export const TRADE_TAKE_SHARE = 0.5;
/** Stops a trader weighs (the nearest of its range). */
export const TRADE_CANDIDATES = 6;
/** Share of a miner's load that is rare ore. */
export const MINER_RARE_SHARE = 0.2;
/** What a miner digs: the common ore, then the rare one (MINER_RARE_SHARE of the load). */
export const MINER_ORE = ['item.iron_ore', 'item.rare_ore'] as const;

/**
 * Stranding (stranded.ts). A ship that cannot pay for any jump and finds no fuel on sale in its node may call for a tug. It arrives after DISTRESS_TURNS turns
 * (game-time turns, TURN_SEC each) with enough fuel for DISTRESS_HOPS of the cheapest jumps (at least DISTRESS_MIN_FUEL units) at DISTRESS_MARKUP times the
 * item's base price. The tug always delivers: the player pays what they can, and a shortfall costs DISTRESS_UNPAID_REP reputation with the traders.
 */
export const DISTRESS_TURNS = 2;
export const DISTRESS_HOPS = 2;
export const DISTRESS_MIN_FUEL = 6;
export const DISTRESS_MARKUP = 3;
export const DISTRESS_UNPAID_REP = 2;
