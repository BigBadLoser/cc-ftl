import type { WorkCategory } from './crew/components';

/** Crew skills the stat resolver knows (0 = untrained; roles add levels). */
export type SkillName = 'gunnery' | 'piloting' | 'shielding';

/** ASCII ship layout. One char per tile, rows top to bottom (row index = y). */
export interface ShipTemplate {
  name: string;
  /** Modules to place at game start; `rot` is quarter turns clockwise (0..3). */
  modules?: { def: string; x: number; y: number; rot: number; stock?: ItemQty[]; /** Vehicle def stowed in this module (a vehicle bay). */ vehicle?: string }[];
  /** '.' space, '#' wall, '_' floor, 'D' door. Rows may differ in length; short rows pad with space. */
  rows: string[];
  /** Faction of the ship (default 'player' for newGame, 'hostile' for debug.spawnEnemy). */
  faction?: 'player' | 'hostile' | 'neutral';
  /** Role ids of the crew to spawn. */
  crew?: string[];
  /** Enemy targeting doctrine (default 'random'). */
  doctrine?: 'weapons' | 'shields' | 'random';
  /**
   * Boarding doctrine flag (hostile ships). Present = the ship may send `party` crew by shuttle to an airlock of the
   * player's ship once `afterSec` seconds of combat have passed, or earlier when fewer than half its weapons work or its
   * integrity falls below `losingBelow`. Absent = it never boards (keeps the balance scenarios comparable).
   */
  boarding?: { party: number; afterSec: number; losingBelow: number };
}

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
  | { type: 'shieldDrain'; layers: number };

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
   * Airlock: footprint [1, n] with n >= 3 and `hullEdge: 'n'`. Local row 0 is the outer door (on the hull line), the last
   * row the inner door, the rows between the chamber. Placing it turns those tiles into doors and floor. Cycling takes
   * `cycleSec` and moves the chamber's air to or from the ship, so crew passing never vents the ship.
   */
  airlock?: { cycleSec: number };
  /**
   * Vehicle bay: an interior landing pad (walkable, no hull contact needed; the vehicle launches through a hatch in the
   * pad). Holds one vehicle whose `VehicleDef.class` equals `class` ('shuttle' bays are 4x5; later 'pod' bays, 3x3, for
   * mining and construction pods). Crew board and leave it at `access` (inside the footprint, so list it in `openTiles`
   * too).
   */
  vehicleBay?: { class: string };
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
  /** AI core: operates the ship's point defence (and, later, other automation) at this tier. */
  aiCore?: { tier: number };
  /** Render asset id of the special roof tile drawn above this module on roofed (enemy) ships, e.g. 'roof.weapon'. Render-only. */
  roofAsset?: string;
  /** Has a roof part that folds away: seconds for a full deploy (or stow). Absent = always out. */
  deploySec?: number;
}
