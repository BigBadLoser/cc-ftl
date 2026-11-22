import type { Filler } from './assembly/roomSize';
import type { Profile } from './hull/silhouette';
import type { RoomRole } from './types';

/**
 * Outline ship recipes (SHIPGEN_V4, "Ship recipes and layout parts"): what a ship type is, as data on its faction
 * (`FactionDef.outline`, keyed by type id). The outline pipeline runs a recipe's layout and asks nothing about its type.
 */

/** Rooms a ship may have past its plan's: a med bay with its trauma room, a brig, a farm, the mess's pantry, a lounge. */
export type ShipRoom = 'medbay' | 'brig' | 'farm' | 'pantry' | 'lounge';

/** How a ship's people sleep: barracks of bunks, barracks of single beds, or every bed a cabin. */
export type Sleep = 'bunks' | 'beds' | 'cabins';

/** The small hulls' layout: blocks cut by one splitter (blockLayout.ts), the guns forward or spread down the hull. */
export interface BlocksLayout { kind: 'blocks'; guns: 'forward' | 'spread' }

/**
 * Rooms on bays (bayRooms.ts), and the layout parts it takes (PROTOTYPE, #581):
 * - `battery`: gun rooms in blisters along a maintenance corridor, the airlock between them; else the airlocks at the
 *   cross corridor.
 * - `lane`: a launch lane open out of the stern (the profile's split): a hangar at its head, the spine ending at the
 *   cross corridor ahead of it, a corridor down each side hull. The lane narrows where a side hull is too shallow.
 * - `decks`: passenger decks aft of the airlocks: single cabins both sides of the spine (its shallow bays), the commons
 *   in its deep ones; command, stores and systems forward.
 * - `drum`: a liner's drum amidships, its own rooms (parts/drum.ts): a garden, a ring corridor, cabins outboard.
 */
export interface BaysLayout { kind: 'bays'; battery?: boolean; lane?: boolean; decks?: boolean; drum?: boolean; program?: ProgramRules }

/** A bay ship's room program past its plan (bayRooms.ts), each set by its parts and over them by the recipe. */
export interface ProgramRules {
  /** Escape pods in place of the plan's hangars (the frame has the hangar). */
  pods?: boolean;
  /**
   * Mirrored sides: the guns and the point-defence pair fixed (the plan's point-defence room dropped), life support a
   * room a side, the mess 9x4.
   */
  mirror?: boolean;
  /** An annex (the pantry) cut beside its host, not behind it (the med bay keeps its trauma room behind). */
  beside?: boolean;
  /** A hold may take all its bays: spare floor is storage. */
  holds?: boolean;
  /** Floor a small room may take, as a multiple of its plan. */
  grow?: number;
  /** A point-defence turret a side, a pair of 4x4 rooms (where the sides do not mirror: mirrored, the part fixes it). */
  pd?: boolean;
  /** Cabin blocks for the beds where the part's cabin strip is too short for them (else the layout fails). */
  blocks?: boolean;
}

/**
 * A bay ship's departments (zones.ts), each its own run of bays: command, systems and stores forward, hab, and on a lane
 * hull flight ops and the guns outboard.
 */
export type ShipDept = 'command' | 'systems' | 'hab' | 'stores' | 'flight' | 'weapons';

/** What goes where on a bay ship, past the defaults (`deptsOf`): each part a recipe may set. */
export interface DeptRules {
  /** A room role's department, where not its default (on passenger decks the guns go with the systems). */
  of?: Partial<Record<RoomRole, ShipDept>>;
  /** A department's own rooms for spare floor, taken in turn. */
  fill?: Partial<Record<ShipDept, readonly Filler[]>>;
  /** Spare-floor rooms the ship has one of at most. */
  once?: readonly Filler[];
  /** Spare-floor rooms where bays have no department (a cruiser), in order. */
  spare?: readonly Filler[];
  /** The forward section's departments, bow to aft, in each order it may take (the best cut of them all). */
  forward?: readonly (readonly ShipDept[])[];
}

export interface OutlineRecipe {
  /** The hull family whose budget it plans with. */
  family: string;
  /** Takes its family's even seeds (a destroyer: every other frigate). */
  evenSeeds?: boolean;
  /** Its silhouettes, one picked a seed. */
  profiles: readonly Profile[];
  /** The widest its hull grows, in tiles with its hull walls: past it, a hull grows longer instead. */
  maxBeam: number;
  /** The hull's least length in tiles. */
  minLength?: number;
  /** Engines every ship of the type plans (more where an attempt adds them), in place of its budget's. */
  engines?: number;
  /** Shuttle bays, where the type's size calls for one (over its hull family's). */
  bays?: number;
  /** Guns every ship of the type carries, one to a room, in pairs (`ShipRoleDef.guns`). */
  gunRooms?: number;
  bonus?: Partial<Record<'weapons' | 'engines' | 'crew' | 'crates' | 'shields' | 'pointDefense' | 'reactors', number>>;
  /** How the crew sleeps; `rooms`: its barracks that many rooms (pieces along two walls), not the plan's. */
  crew: { sleep: Sleep; rooms?: number };
  /** Passenger beds past the crew's, single cabins: a base and more a depth. */
  passengers?: { base: number; perDepth: number };
  /** Rooms past the plan's (a pantry comes off the mess). */
  rooms?: readonly ShipRoom[];
  layout: BlocksLayout | BaysLayout;
  depts?: DeptRules;
}
