/**
 * Room recipes: data-driven layout rules per room role. A recipe lists 2-3 arrangements; the seed picks one per room,
 * plus a mirror (port and starboard swapped) and the alternatives of each step. Directions are in the ship frame:
 * fore is -x (the bow), aft +x (the engines), port -y, starboard +y.
 */

export type Dir = 'fore' | 'aft' | 'port' | 'stbd';

/** A wall a module backs onto: one side, either long wall, either end wall, or any wall. */
export type Wall = Dir | 'long' | 'end' | 'any';

export interface Step {
  /** Module id, or several the seed chooses between (once per room). */
  mod: string | readonly string[];
  /**
   * How many: 'spec' places the room's planned modules of this id (required ones; they fall back to the generic
   * placer if the recipe finds no spot); a number places up to that many extras; 'fill' places until the room's
   * fill target.
   */
  count: 'spec' | number | 'fill';
  /** With `count: 'fill'`: at most one of this step's module per module of this def in the room (a locker a bed). */
  per?: string;
  /** Walls the footprint should back onto (preferred, not required). */
  wall?: Wall;
  /** A second-choice wall, scored lower (the helm backs onto a long wall when the fore wall has a door). */
  wall2?: Wall;
  /** Prefer the room's end or side toward this direction (the helm toward the bow). */
  toward?: Dir;
  /** Pack: prefer touching walls and other modules on as many sides as possible (cargo holds). */
  pack?: boolean;
  /** For 'fill': this step's own fill target instead of the recipe's (mess tables fill a big hall). */
  upTo?: number;
  /** For 'spec': place only this share of the planned modules (rounded up); fill steps use the rest of the room. */
  share?: number;
  /** Which way the module's front (access side, or a chair's seat) must point. 'in' faces the room's middle. */
  face?: Dir | 'in';
  /** Turn to face the nearest module of this id (consoles facing the helm, chairs facing a table). */
  faceTo?: string;
  /** Prefer the middle of the room along this axis (x along the ship, y across it). */
  centre?: 'x' | 'y' | 'xy';
  /** Prefer touching a module of this id. */
  near?: string;
  /** Keep this far (tiles of clear floor) from other modules: strong preference for open space around it. */
  clear?: number;
  /** Prefer lining up with the room's earlier modules of the same id (rows of beds, racks in aisles). */
  row?: boolean;
  /** Repeats prefer a lattice through the room's first one, this pitch apart: tables in tidy rows and columns. */
  grid?: readonly [number, number];
  /** Skip the step when the room already holds a module of this id. */
  unless?: string;
  /** Place at most one of these on the whole ship (one galley per ship). */
  once?: boolean;
  /** Skip the step in rooms with fewer floor tiles than this. */
  minFloor?: number;
  /** Companions set around each placed module: chairs at a table, facing it, long sides first; or, on a `spec` step, bigger pieces (ore bins) flush against the planned module, away from its access tile. Up to `n`; with `big`, one of that bigger module is tried first and counts toward `n`. */
  with?: { mod: string; n: number; big?: string };
  /** Rotations to try (default: the module's generator rotations). */
  rots?: readonly number[];
}

export interface Arrangement {
  /** Lay the room out at once from a repeating unit (rooms/plans.ts); its steps are the fallback when the plan does not fit. */
  plan?: { kind: 'berths'; lounge?: boolean } | { kind: 'aisles'; piece: 'module.storage_rack' | 'module.storage_pallet' };
  name: string;
  weight: number;
  /**
   * Reserve one clear walkway before anything goes in: a spine along the room's long axis (or across it, 'cross'),
   * joined by the shortest floor path to every door and every protected tile (airlock insides, unloader stands).
   */
  walkway?: 'long' | 'cross';
  /** Hand-made furniture groups set into the open floor first (rooms/vignettes.ts). */
  vignettes?: VignetteSet;
  steps: readonly Step[];
}

/** A hand-made group of modules, laid out at rotation 0 round its origin (chairs turn to face their table). */
export interface Vignette {
  name: string;
  mods: readonly { mod: string; x: number; y: number; rot?: number }[];
}

export interface VignetteSet {
  pieces: readonly Vignette[];
  /** Least distance in tiles between two pieces' anchors. */
  gap: number;
  /** Share of the room's floor the pieces fill before they stop. */
  upTo: number;
  /** Rooms smaller than this get none. */
  minFloor?: number;
  /** A landmark set at the middle of rooms of at least `centreFloor` tiles before the rest (the court's centrepiece). */
  centre?: Vignette;
  centreFloor?: number;
}

export interface RoomRecipe {
  /** Target share of the room's floor under modules (lights excluded) for 'fill' steps. */
  fill: number;
  arrangements: readonly Arrangement[];
}
