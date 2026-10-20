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
  /** Walls the footprint should back onto (preferred, not required). */
  wall?: Wall;
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
  /** Rotations to try (default: the module's generator rotations). */
  rots?: readonly number[];
}

export interface Arrangement {
  name: string;
  weight: number;
  steps: readonly Step[];
}

export interface RoomRecipe {
  /** Target share of the room's floor under modules (lights excluded) for 'fill' steps. */
  fill: number;
  arrangements: readonly Arrangement[];
}
