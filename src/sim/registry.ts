import type { Faction } from './combat/components';
import type { FactionDef } from './shipgen/types';
import type { StationDef } from './shipgen/stationTypes';
import type { WorkCategory } from './crew/components';

/** Crew skills the stat resolver knows (0 = untrained; roles add levels). */
export type SkillName = 'gunnery' | 'piloting' | 'shielding' | 'melee' | 'repair' | 'hacking';

/** ASCII ship layout. One char per tile, rows top to bottom (row index = y). */
export interface ShipTemplate {
  name: string;
  /** Modules to place at game start; `rot` is quarter turns clockwise (0..3). */
  modules?: { def: string; x: number; y: number; rot: number; stock?: ItemQty[]; /** Standing production orders of a crafting module (e.g. keep 10 rations). */ orders?: { recipe: string; mode: 'count' | 'keep'; target: number }[]; /** Vehicle def stowed in this module (a vehicle bay). */ vehicle?: string; /** Container modules: the side of the footprint clamped to the frame (default 'n'). */ clamp?: 'n' | 'e' | 's' | 'w' }[];
  /** '.' space, '#' wall, '_' floor, 'D' door, '=' beam. Rows may differ in length; short rows pad with space. */
  rows: string[];
  /** Faction of the ship (default 'player' for newGame, 'hostile' for debug.spawnEnemy). */
  faction?: Faction;
  /** Role ids of the crew to spawn. */
  crew?: string[];
  /** Enemy targeting doctrine (default 'random'). */
  doctrine?: 'weapons' | 'shields' | 'random';
  /**
   * Boarding doctrine flag (hostile ships). Present = the ship may send `party` crew by shuttle to an airlock of the
   * player's ship once `afterSec` seconds of combat have passed, or earlier when fewer than half its weapons work or its
   * integrity falls below `losingBelow`. Absent = it never boards (keeps the balance scenarios comparable).
   */
  boarding?: { party: number; afterSec: number; losingBelow: number; /** Hand weapon (item id) issued to the party when it leaves. */ weapon?: string };
}

import type { EventDef } from './story/defs';
import type { TradeDef } from './trade/types';

/** Content injected at boot. The sim only reads it; it is never saved. */
export interface ContentRegistry {
  ships: Record<string, ShipTemplate>;
  /** Role content id (e.g. 'role.engineer') to definition. */
  roles: Record<string, RoleDef>;
  /** Species content id (e.g. 'species.human') to definition. */
  species: Record<string, SpeciesDef>;
  /** Module content id (e.g. 'module.reactor') to definition. */
  modules: Record<string, ModuleDef>;
  /** Pool of first names for generated crew. */
  crewNames: string[];
  /** Item content id (e.g. 'item.metal') to definition. */
  items: Record<string, ItemDef>;
  /** Recipe content id to definition. */
  recipes: Record<string, RecipeDef>;
  /** Build cost per struct kind: keys 'floor', 'wall', 'door'. Deconstructing refunds DECON_REFUND of it. */
  structCosts: Record<string, ItemQty[]>;
  /** Weapon content id (e.g. 'weapon.burstLaser') to definition. Absent = no weapons. */
  weapons?: Record<string, WeaponDef>;
  /** Vehicle content id (e.g. 'vehicle.shuttle') to definition. Absent = no vehicles. */
  vehicles?: Record<string, VehicleDef>;
  /** Event content (story/defs.ts) by id. Absent = no events. */
  events?: Record<string, EventDef>;
  /** The EVA spacesuit. Absent = DEFAULT_SUIT (tuning.ts). */
  suit?: SuitDef;
  /** Faction content id (e.g. 'faction.scrapper') to definition, for generated ships. Absent = none. */
  factions?: Record<string, FactionDef>;
  /** Station kinds the station generator builds (src/sim/shipgen/stationGen.ts). */
  stations?: Record<string, StationDef>;
  /** Trade: prices' spread, faction stances and trader profiles. Absent = nobody trades. */
  trade?: TradeDef;
  /** Derelict infestations: what hatches from egg sacs. Absent = sacs hatch nothing. */
  creatures?: CreatureDefs;
}

/** Derelict creatures (content/creatures.ts). */
export interface CreatureDefs {
  /** What an egg sac hatches, by weight: a role id (of a `creature` species). */
  hatch: readonly { role: string; weight: number }[];
}

/** The EVA spacesuit every non-airless crew member can wear (put on and taken off at an airlock). */
export interface SuitDef {
  /** Seconds of air in a full tank. It drains only while the wearer is in thin air or crossing open space. */
  airSec: number;
  /** Seconds to put the suit on / take it off at an airlock. */
  donSec: number;
  doffSec: number;
  /** Stat multipliers while suited: walking and working are slower, hand-weapon hits land less often. */
  moveMult: number;
  workMult: number;
  accuracyMult: number;
  /** Drifting between a hovering shuttle and a ship's hull: tiles per second, and the farthest gap (tiles) it can cross. */
  floatSpeed: number;
  floatRange: number;
}

/** A shuttle type. It is an entity in the sector, not a grid: no interior, crew aboard are hidden. */
export interface VehicleDef {
  name: string;
  /** Which bays take it: matches ModuleDef.vehicleBay.class. */
  class: string;
  /** Render asset id. */
  asset: string;
  /** Sector tiles per second at piloting skill 0. */
  speed: number;
  maxHp: number;
  /** Passengers besides the pilot. */
  capacity: number;
  /** Chance 0..1 that a weapon shot aimed at it in flight misses. */
  evasion: number;
  /** Cargo hold: total item units it carries besides its crew (hauled in and out at its boarding tile). Absent = none. */
  cargo?: number;
  /** EVA from a hovering shuttle: suits stowed aboard (the hatch works like an airlock for them) and how far off a target's hull it holds station (tiles). */
  eva?: { suits: number; hoverGap: number };
}

/** One typed result of a weapon impact. All are applied by combat/effects.ts. */
export type Effect =
  /** Wall/door integrity loss on the impact tile; `radius` tiles around it take `amount * falloff`. */
  | { type: 'hullDamage'; amount: number; radius?: number; falloff?: number }
  | { type: 'moduleDamage'; amount: number; radius?: number }
  | { type: 'crewDamage'; amount: number; radius?: number }
  /** Sets fire on floor tiles in the plus shape (radius 1) or just the impact tile (0). */
  | { type: 'ignite'; radius?: number }
  /** Disables the module on the impact tile. `ifNoDrain`: only when no shield layer was drained by this hit. */
  | { type: 'ionDisable'; seconds: number; ifNoDrain?: boolean }
  | { type: 'shieldDrain'; layers: number }
  /**
   * EMP burst: ion-disables every module and stuns every ion-vulnerable crew member (SpeciesDef.ionStunSec) within
   * `radius` tiles. No weapon uses it yet; it is the hook for EMP warheads and, later, combat drones.
   */
  | { type: 'emp'; seconds: number; radius: number };

/** A weapon: how it charges, flies and what it does. Power draw is on the carrying ModuleDef. */
export interface WeaponDef {
  name: string;
  /** Render asset id of the projectile. */
  projectileAsset: string;
  /** Shots per volley. */
  shots: number;
  /** Seconds between shots of one volley. */
  shotDelaySec: number;
  /** Seconds to charge at operator skill 0. */
  chargeSec: number;
  /** Projectile speed in sector tiles per second. */
  speed: number;
  /** Aim error sigma in tiles at operator skill 0. */
  spread: number;
  /** Item consumed per shot. */
  ammo?: string;
  /** Point defence may shoot it down. */
  interceptable?: boolean;
  /**
   * Shield rule: a shot is blocked when layers > pierce (and `bypass` is off), removing `damage` layers.
   * `bypass` skips shields entirely.
   */
  shield: { damage: number; pierce: number; bypass?: boolean };
  /** Applied (in order) when the shot lands on the hull. */
  effects: Effect[];
}

/** An item id with a quantity. */
export interface ItemQty {
  item: string;
  count: number;
}

export interface ItemDef {
  name: string;
  tags: string[];
  /** Most units one floor stack or one storage slot holds. */
  stackSize: number;
  /** 0..1 fuel factor for a loose stack on a burning tile. Default 0 (does not burn). */
  flammability?: number;
  /** VehicleDef id: a vehicle bay can turn one of these into a shuttle (vehicle.assign). */
  vehicle?: string;
  /** Present = crew can equip it and fight with it. */
  hand?: HandWeaponDef;
  /** Present = hungry crew eat it from storage: eating one restores `nutrition` hunger points (0..100 scale). */
  food?: { nutrition: number };
  /** Base price in credits. Absent = not for sale. Traders add a spread and modifiers on top (see trade/pricing.ts). */
  price?: number;
  /** Quality tier of gear (1 basic, 2 middle grade, 3 the best). Traders' surplus rules sell only up to a tier. */
  tier?: number;
}

/** A hand weapon (sidearm, rifle, blade) carried by crew. Ranged ones need line of sight; melee ones need adjacency. */
export interface HandWeaponDef {
  kind: 'ranged' | 'melee';
  /** Hp taken from the target per hit. */
  damage: number;
  /** Tiles (ranged only; melee reaches the 8 neighbours). */
  range: number;
  /** Seconds between attacks. */
  cooldownSec: number;
  /** Base hit chance 0..1 before skill, range and cover. */
  accuracy: number;
  /** Ion weapon: a hit also stuns an ion-vulnerable target (SpeciesDef.ionStunSec). */
  ion?: true;
  /** A hit knocks the target down (stunned, StunC) for `knockdownSec` with this chance. */
  knockdownChance?: number;
  knockdownSec?: number;
}

export interface RecipeDef {
  name: string;
  /** Module def id of the station that crafts it. */
  station: string;
  inputs: ItemQty[];
  outputs: ItemQty[];
  /** Ticks of work at workSpeed 1. */
  work: number;
}

/** A crew role: default priorities for each work category (0 = off, 1 = highest .. 4). */
export interface RoleDef {
  name: string;
  priorities: Record<WorkCategory, number>;
  /** Skill levels this role adds through the stat resolver. */
  skills?: Partial<Record<SkillName, number>>;
  /** Fights even unarmed, and hunts boarders it cannot see yet. Other roles flee from hostiles unless armed. */
  fighter?: true;
  /** Item ids (best first) the crew member fetches from storage on their own when unarmed. */
  loadout?: string[];
  /** Species of crew spawned in this role (default 'species.human'). Robot variants are roles of robot species. */
  species?: string;
  /** A robot bay can assemble this role (module.assembleRobot): materials delivered, then `work` ticks at workSpeed 1. */
  assemble?: { cost: readonly ItemQty[]; work: number };
  /** Hp fraction (0..1) under which this role surrenders when outnumbered. Default: SURRENDER_HP_FRAC for non-player crew, never for player crew. */
  surrenderBelow?: number;
}

/** A species: base stats. Modifiers (traits, implants) come later via the stat resolver. */
export interface SpeciesDef {
  name: string;
  /** Tiles per second. */
  moveSpeed: number;
  /** Work points per tick (1 = baseline). */
  workSpeed: number;
  /** Rest lost per second while awake. */
  restDecay: number;
  /** Units a crew member carries at once (default DEFAULT_CARRY_CAPACITY). */
  carryCapacity?: number;
  /** Max hp (default CREW_MAX_HP). */
  maxHp?: number;
  /** Generated names are `<designation>-<3 digits>` instead of first names from the pool. */
  designation?: string;
  // Body flags. Systems gate behaviour on these, never on species ids. Absent = organic defaults.
  /** Does not breathe: uses no O2, immune to thin air, CO2 and vacuum cold. Heat and fire still hurt. */
  airless?: true;
  /**
   * Mechanical body: no natural regeneration and no bed healing. Crew with the `repair` skill mend it (a 'mend' job),
   * using one unit of the first of `items` the ship's storage holds per `hpPerItem` hp restored.
   */
  mechanical?: { items: readonly string[]; hpPerItem: number };
  /** Ion- and EMP-vulnerable: stunned this many seconds per ion hit. Absent = immune. */
  ionStunSec?: number;
  /** Never flees from hostiles and never surrenders (and will ignore fire panic once danger avoidance exists). */
  fearless?: true;
  /** At 0 hp it is wrecked (dead at once, no bleeding out) and leaves a wreck that crew salvage for these items. */
  wreck?: readonly ItemQty[];
  /** On a rogue ship it is run by that ship's AI core and goes inert while no core is live (CoreLinkC). */
  coreLinked?: true;
  /** Fraction (0..1) of incoming hand-weapon and ship-weapon crew damage the body shrugs off. Default 0. */
  armor?: number;
  /**
   * Runs on a battery instead of sleeping (Needs.charge, 0..100): drains `drainPerSec` per second, `busyMult` times
   * faster while working or fighting. Under `lowBelow` (or when badly damaged) it goes to its robot bay to recharge;
   * at 0 it crawls (EMPTY_CHARGE_MULT).
   */
  charge?: { drainPerSec: number; busyMult: number; lowBelow: number };
  /** Gets hungry: Needs.hunger (100 = fed) falls this much per second (half while asleep). Absent = never eats (robots). */
  hunger?: { decayPerSec: number };
  /** Has moods (MoodC: a score built from named factors that slows work when low). Absent = no mood (robots). */
  mood?: true;
  /** The body's own weapon (claws, spit), used instead of bare fists when nothing is equipped. `id` names it in events and the UI. */
  natural?: HandWeaponDef & { id: string };
  /**
   * A wild creature (aliens): no jobs, needs or colony AI; it idles near where it hatched, hunts what it sees, and runs
   * from its foes under `fleeBelow` of its max hp. `keepAway`: a ranged creature backs off from foes closer than this
   * many tiles. At 0 hp it dies at once (no downed state, no rescue).
   */
  creature?: { fleeBelow: number; keepAway?: number };
}

/**
 * Tile roles of an airlock with a docking collar, as [col, row] offsets in the unrotated footprint (row 0 is the hull row;
 * rows count inboard, cols run along the hull). The collar lies outside the footprint, one tile beyond the hull row.
 */
export interface AirlockLayout {
  /** The pod: the inner door. */
  inner: readonly [number, number];
  /** The hull tile with the outer door (the iris hatch of the collar behind it). */
  outer: readonly [number, number];
  /** Walkable tile in front of the inner door: where passengers board and land. */
  inside: readonly [number, number];
  /** The docking collar, one tile past the hull row. Not in the footprint. */
  collar: readonly [number, number];
  /** Cargo unloaders: solid body tiles, the chute tile where a crate shows, and the keep-out tile crew stand on to work it. */
  unloaders: readonly { tiles: readonly (readonly [number, number])[]; chute: readonly [number, number]; stand: readonly [number, number] }[];
}

/**
 * A placeable ship module. `footprint` is [w, h] at rotation 0; (x, y) of a placed module is the
 * top-left of its rotated bounding box. Offsets (`access`) are in rotation-0 local tiles.
 */
export interface ModuleDef {
  name: string;
  /** Render asset id, e.g. 'module.reactor' (resolved through the asset manifest). */
  asset: string;
  footprint: readonly [number, number];
  /** Solid modules block walking on their tiles. */
  solid: boolean;
  /** Cover this solid module gives a target standing right behind it (default 'partial'). */
  cover?: 'partial' | 'full';
  /**
   * Tile (offset from the footprint's top-left at rotation 0) crew stand on to use it. It may lie outside the
   * footprint (a tile beside the module) or inside it, in which case it must also be listed in `openTiles`.
   */
  access?: readonly [number, number];
  /**
   * Per-tile solidity: footprint tiles (rotation-0 offsets) crew can walk on although the module is solid, e.g. a
   * console's chair and the free floor beside it. All other footprint tiles of a solid module block walking.
   */
  openTiles?: readonly (readonly [number, number])[];
  /** Positive supplies power, negative draws it (units per second). */
  power: number;
  /** Power priority 1 (served first) .. 5. Default DEFAULT_PRIORITY. */
  priority?: number;
  /** Oxygen added per second, spread over the module's room. */
  o2PerSec?: number;
  /** CO2 removed per second, spread over the module's room. */
  co2ScrubPerSec?: number;
  /** Degrees C x tiles added per second, spread over the footprint. */
  heatPerSec?: number;
  /** Lights tiles of its own room within `radius` tiles; `level` is 0..255 at the source. */
  light?: { radius: number; level: number };
  /** 0..1 fuel factor for fire spread and growth. */
  flammability: number;
  maxHp: number;
  /** Construction work in ticks at workSpeed 1. */
  buildWork: number;
  bed?: true;
  /** A galley: hungry crew eat on its access tile (a hot meal lifts mood). Pairs with `crafting` for a food printer. */
  galley?: true;
  workstation?: true;
  /** Materials to build it; deconstructing refunds DECON_REFUND of them. */
  cost?: ItemQty[];
  /** Holds items: capacity in stacks. */
  storage?: { capacity: number };
  /** Crafts recipes whose `station` is this def (gets a ProductionC order list). */
  crafting?: true;
  /**
   * Replaces the hull wall: the footprint side (rotation 0; rotation turns it clockwise: n -> e -> s -> w) lying on
   * the hull line. Its tiles must be existing exterior wall tiles with Space beyond them. They stay Wall (airtight,
   * immune to hull damage) whether or not the module works or exists.
   */
  hullEdge?: 'n' | 'e' | 's' | 'w';
  /**
   * Airlock, `hullEdge: 'n'`. Without `layout` it is a 1-wide line: local row 0 is the outer door (on the hull line), the last
   * row the inner door, the rows between the chamber. With `layout` the tile roles are given explicitly (see AirlockLayout).
   * Placing it turns the door tiles into doors. Cycling takes `cycleSec` and moves the chamber's air to or from the ship,
   * so crew passing never vents the ship.
   */
  airlock?: { cycleSec: number; layout?: AirlockLayout; /** Spacesuits stowed in the airlock at build time (default 0). Crew put one on and take it off here. */ suits?: number };
  /**
   * Vehicle bay: a pit the vehicle sits in (solid, nothing walkable inside; it launches through hatch doors in the pit
   * floor). Holds one vehicle whose `VehicleDef.class` equals `class` ('shuttle' bays are 4x5; later 'pod' bays, 3x3, for
   * mining and construction pods). Crew board and leave it at `access`, a floor tile beside the footprint.
   */
  vehicleBay?: { class: string };
  /**
   * Marks the ship's bridge for capture (a helm console counts as one with the defaults). Holding it means a live
   * crew member of the attacking side stands within `radius` tiles (default CAPTURE_BRIDGE_RADIUS) of the module's access
   * tile for `holdSec` seconds (default CAPTURE_HOLD_SEC) while every crew member of the ship is subdued.
   */
  bridge?: { holdSec?: number; radius?: number };
  /** Marks a console; its operator runs that ship system during combat. */
  console?: 'weapons' | 'shields' | 'helm';
  /** WeaponDef id this module fires. */
  weapon?: string;
  /** Shield generator: layers = floor(|power| * layersPerPower); one layer returns every `rechargeSec`. */
  shieldGen?: { layersPerPower: number; rechargeSec: number };
  /** Engine: evasion added per unit of power (needs a pilot). */
  engine?: { evasionPerPower: number };
  /** Point-defence turret: shoots down interceptable shots; needs a working AI core on the ship. */
  pointDefense?: true;
  /**
   * Robot fabricator: while powered, intact and on a grid whose ship has a live AI core, it builds a robot of the
   * ship's faction every `intervalSec` (cycling through `roles`) next to itself, while fewer than `cap` it made live.
   */
  robotFabricator?: { roles: readonly string[]; intervalSec: number; cap: number };
  /**
   * Robot bay: a charging cradle on the module's anchor tile, home to one robot (Module.reservedBy, like a bed). While
   * powered it recharges the robot in it by `chargePerSec` and repairs `repairPerSec` hp, using the species' repair
   * items from the ship's storage. It also assembles robots (module.assembleRobot).
   */
  robotBay?: { chargePerSec: number; repairPerSec: number };
  /** AI core: operates the ship's point defence (and, later, other automation) at this tier. */
  aiCore?: { tier: number };
  /** Render asset id of the special roof tile drawn above this module on roofed (enemy) ships, e.g. 'roof.weapon'. Render-only. */
  roofAsset?: string;
  /** Has a roof part that folds away: seconds for a full deploy (or stow). Absent = always out. */
  deploySec?: number;
  /**
   * A sealed cargo container (see sim/containers): one solid object on Beam tiles, clamped to a frame, with its own shell
   * and a storage inventory (`storage`). Not a room, no interior: crew never walk to it and haulers skip it. It can be
   * detached (`container.detach`) into a free drifting body carrying its stock.
   */
  container?: true;
}
