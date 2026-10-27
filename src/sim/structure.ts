import type { FieldSpec, GridLike } from './grid';
import { SPACE_TEMP } from './tuning';

/** Structural kind of a tile, stored in the `struct` field. Materials/variants come later. */
export const Struct = {
  Space: 0,
  Floor: 1,
  Wall: 2,
  Door: 3,
  /** A structural beam: solid, airtight, not walkable, no floor and no integrity (struts between assemblies). */
  Beam: 4,
  /**
   * Rock mass: a full-height solid block of asteroid rock. Airtight, not walkable, blocks sight, no integrity (weapons do not
   * chip it), so around a dug room it is a natural wall. Digging turns it into Floor, levelling into Ground, pod mining into
   * Space. Owned (`ship` layer) by its `AsteroidC` entity, or by the ship whose crew dug it.
   */
  Rock: 5,
  /**
   * Rock ground: flat, levelled rock. Walkable, but airless like Space (no gas, space temperature, suits needed), and a
   * foundation: floors, walls, doors and modules build on it as on a deck without hull.
   */
  Ground: 6,
  /**
   * Finished rock wall: dressed stone, a normal 1-tile wall (wall height, airtight, blocks movement and sight, doors can be set
   * into it) with no integrity (weapons do not chip it). Crew make it from rock mass (`job.build` of RockWall: finishing); digging
   * it gives Floor like rock mass. Dug outposts are walled with it.
   */
  RockWall: 7,
} as const;
export type StructKind = (typeof Struct)[keyof typeof Struct];

/**
 * Fields every ship/station/derelict grid has. Grid coordinates: x = column, y = row.
 * World mapping (render): tile (x, y) occupies world X in [x, x+1], Z in [y, y+1], floor at Y = 0.
 */
export const SHIP_FIELDS = {
  /** StructKind per tile. */
  struct: 'u8',
  /** Room id per tile (0 = none). Derived by the rooms system from `struct`. */
  room: 'u16',
  /** Oxygen partial pressure in kPa (normal 21). Space tiles are a fixed 0. */
  o2: 'f32',
  /** Carbon dioxide partial pressure in kPa (normal 0.04). */
  co2: 'f32',
  /** Temperature in degrees C (normal 20). Space tiles are fixed at SPACE_TEMP. */
  temp: 'f32',
  /** Fire intensity 0..255 (0 = no fire). */
  fire: 'u8',
  /** Smoke density 0..255. */
  smoke: 'u8',
  /** Light level 0..255, derived by the lighting system. Below LIGHT_DARK_BELOW counts as dark. */
  light: 'u8',
  /** Door openness 0 (closed) .. 255 (open). Only meaningful on Door tiles. */
  door: 'u8',
  /** A jammed door (DoorJam): held open or shut whatever crew do, until forced (job 'forceDoor'). Door tiles only. */
  jam: 'u8',
  /** Entity id of the module occupying the tile (0 = none). Written by module spawn/remove. */
  module: 'u32',
  /** Entity id of the loose item stack lying on the tile (0 = none). At most one stack per tile. */
  item: 'u32',
  /** Integrity of structural tiles (wall, door) 0..255. At 0 the tile breaches (see combat/breach.ts). */
  hp: 'u8',
  /** Entity id of the owning `ShipC` for non-Space tiles (0 = none). Written by stamping; read by the sector grid. */
  ship: 'u32',
  /** Ore kind on a rock tile: an `OreDef.code` (content/ores.ts), 0 = none. Only rock tiles carry ore. */
  ore: 'u8',
  /** Units of ore left on the tile (0..255); 0 with `ore` 0. */
  oreAmt: 'u8',
} as const satisfies FieldSpec;

/**
 * Empty value of each field: what an unallocated sector chunk reads as (vacuum). Every SHIP_FIELDS key must be present;
 * `SectorGrid` does not store a tile equal to it unless its chunk already exists.
 */
export const SHIP_EMPTY = {
  struct: Struct.Space,
  room: 0,
  o2: 0,
  co2: 0,
  temp: SPACE_TEMP,
  fire: 0,
  smoke: 0,
  light: 0,
  door: 0,
  jam: 0,
  module: 0,
  item: 0,
  hp: 0,
  ship: 0,
  ore: 0,
  oreAmt: 0,
} as const satisfies Record<keyof typeof SHIP_FIELDS, number>;

/** True for rock mass: solid, airtight and unwalkable like a wall, with no integrity. */
export function isRock(kind: number): boolean {
  return kind === Struct.Rock;
}

/** True for a finished rock wall (see `Struct.RockWall`). */
export function isRockWall(kind: number): boolean {
  return kind === Struct.RockWall;
}

/** True for solid rock of either height: rock mass or a finished rock wall (airtight, unwalkable, blocks sight, no integrity). */
export function isSolidRock(kind: number): boolean {
  return kind === Struct.Rock || kind === Struct.RockWall;
}

/** True for rock ground: walkable, airless foundation. */
export function isGround(kind: number): boolean {
  return kind === Struct.Ground;
}

/** True for either rock form (mass or ground): what an asteroid is made of, and what may carry ore. */
export function isAsteroidRock(kind: number): boolean {
  return kind === Struct.Rock || kind === Struct.Ground;
}

/** True for tiles that hold no gas: Space and rock ground (vacuum) and solid tiles (walls, rock mass). */
export function isAirless(kind: number): boolean {
  return kind === Struct.Space || kind === Struct.Ground;
}

/** Jam state of a door tile (`jam` field). A jammed-shut door blocks walking; neither kind moves until forced. */
export const DoorJam = { None: 0, Open: 1, Shut: 2 } as const;

/** True if crew can stand on this tile kind (ignores modules: see modules/walk.ts). */
export function isWalkable(kind: number): boolean {
  return kind === Struct.Floor || kind === Struct.Door || kind === Struct.Ground;
}

/**
 * True if a suited crew member (and nobody else) can stand on this tile: the exterior surface of the same grid, the
 * ring of Space tiles touching anything solid (8-neighbour) that the pack's thrusters let them drift along, and any open truss (`Struct.Beam`). Every walk rule (pathfinder, movement, move orders) asks for it when the walker wears a suit.
 */
export function isEvaWalkable(grid: GridLike, x: number, y: number): boolean {
  if (!grid.inBounds(x, y)) return false;
  if (grid.get('struct', x, y) === Struct.Beam) return true; // an open truss is scaffolding a suited crew member walks along
  if (grid.get('struct', x, y) !== Struct.Space) return false;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if ((dx || dy) && grid.inBounds(x + dx, y + dy) && grid.get('struct', x + dx, y + dy) !== Struct.Space) return true;
    }
  }
  return false;
}

/** Gas conductance of a tile: 0 walls and closed doors, 1 floor/space, a fraction for a partly open door. */
export function gasConductance(kind: number, doorOpen: number): number {
  if (kind === Struct.Floor || kind === Struct.Space || kind === Struct.Ground) return 1;
  if (kind === Struct.Door) return doorOpen / 255;
  return 0;
}

/** Starting integrity of a wall or door tile. */
export const STRUCT_MAX_HP = 255;

/** True if the tile kind has integrity (walls and doors). */
export function hasIntegrity(kind: number): boolean {
  return kind === Struct.Wall || kind === Struct.Door;
}

/** Write a tile's struct kind and reset its integrity to match (full for walls/doors, 0 otherwise). Keeps the owner. */
export function writeStruct(grid: GridLike, x: number, y: number, kind: number): void {
  if (grid.get('struct', x, y) !== kind) grid.set('struct', x, y, kind);
  const hp = hasIntegrity(kind) ? STRUCT_MAX_HP : 0;
  if (grid.has('hp') && grid.get('hp', x, y) !== hp) grid.set('hp', x, y, hp);
  if (grid.has('jam') && grid.get('jam', x, y) !== 0) grid.set('jam', x, y, 0);
  syncOwner(grid, x, y);
}

/**
 * Keep the `ship` owner layer in step with a tile's struct kind: Space has no owner; a new structure tile with none takes
 * the owner of its first owned 4-neighbour (E, W, S, N), so a build job extends the ship it is attached to.
 */
export function syncOwner(grid: GridLike, x: number, y: number): void {
  if (!grid.has('ship')) return;
  const owner = grid.get('ship', x, y);
  if (grid.get('struct', x, y) === Struct.Space) {
    if (owner !== 0) grid.set('ship', x, y, 0);
    return;
  }
  if (owner !== 0) return;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const n = grid.inBounds(x + dx, y + dy) ? grid.get('ship', x + dx, y + dy) : 0;
    if (n !== 0) {
      grid.set('ship', x, y, n);
      return;
    }
  }
}

/** True if any 4-neighbour of (x, y) is Space or lies outside the grid (the ship's outer boundary). */
export function bordersSpace(grid: GridLike, x: number, y: number): boolean {
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const nx = x + dx;
    const ny = y + dy;
    if (!grid.inBounds(nx, ny) || grid.get('struct', nx, ny) === Struct.Space) return true;
  }
  return false;
}
