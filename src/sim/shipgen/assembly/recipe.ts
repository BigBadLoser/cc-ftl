import type { Dept } from '../stationDepartments';
import type { Outline } from '../stationFlowKit';
import type { Dir } from './model';
import type { Gap } from './ring';

/**
 * A recipe: what a station is composed of and how its parts stand to each other. It names no coordinate and no room.
 * Departments are matched to the parts that take them; every room of the program must find a place in one of them, or
 * the candidate is rejected (assemble.ts).
 */

/** A number, or a range the seed rolls in. */
export type Roll = number | readonly [number, number];

export interface BranchRule {
  /** The departments whose rooms it carries, each as its own branch or all on one. */
  takes: readonly Dept[];
  per: 'department' | 'together';
  /**
   * Where a branch starts: off the trunk's sides, on a ring's rim (directions in order of preference), at an arc's cut
   * end, at the far end of another rule's branch (its index in `branches`), or on the end or side of any section
   * already standing, the newest first (a cluster that grows).
   */
  host: { on: 'trunk' } | { on: 'rim'; prefer: readonly Dir[]; roll?: boolean } | { on: 'tip' } | { on: 'after'; rule: number } | { on: 'section' };
  /** Corridor before the first section (0: joined directly). On a ring's rim the band's depth is added. */
  neck: Roll;
  /** Rooms dealt to sections at random across the departments it takes, each section its own branch (scrappers). */
  mix?: boolean;
  /** Sections on one branch at most; a department with more gets another branch. Default: all on one. */
  most?: number;
  /** A gate at the foot: a controlled department. Hard: nothing else joins a gated branch or stands against it. */
  gated?: boolean;
  /** Its sections: rooms in each, one floor depth for a slab or the rooms' own for staggered bays, a room across the last one's end. */
  section: { rooms: readonly [number, number]; rowDepth?: number; cap?: boolean; even?: boolean; cross?: boolean };
  /**
   * How its sections stand: in series along the branch (beads on a string), or on the sides of one stem corridor (a
   * comb). Default series.
   */
  arrange?: 'series' | 'sides';
  /** Corridor between sections in series; on a stem, the run of stem each section is given. */
  link: Roll;
  /** Chance a later section turns off the side of the link instead of carrying straight on. */
  fork?: number;
  /** The station's docks stand in this branch's first section (a dock block). Hard: every dock must stand. */
  docks?: boolean;
}

export interface Recipe {
  name: string;
  root:
    /** A trunk corridor: everything hangs off its sides. `pairs`: chance a branch stands opposite the one before; `step`: trunk between one branch and the next. */
    | { kind: 'trunk'; pairs: number; step: Roll }
    /** No root of its own: the first branch stands at the centre and the rest grow from the sections. */
    | { kind: 'core' }
    /** A ring or an arc with its band: it takes these departments itself. */
    | { kind: 'ring'; takes: readonly Dept[]; outline: Outline; cut: number; inner: boolean; gap?: Gap };
  branches: readonly BranchRule[];
  /**
   * How the crew sleeps, when not in quarters cut into cabins where they stand:
   *   scatter   every bed a small cabin of its own, standing among the other sections' rooms and as pods on spare ports
   *   barracks  shared rooms of this many beds each, in double bunks (two beds to a bunk, an aisle between two rows);
   *             `singles` beds are kept as private cabins and scattered
   * Hard either way: every bed of the program stands.
   */
  quarters?: 'scatter' | { barracks: readonly [number, number]; singles?: number };
  /**
   * Bracing: open beams (the game's truss tile) across the gaps between sections that stand near each other, so a
   * station of modules on stubs reads as one structure. The chance, 0 to 1, that a gap that can take a brace gets one.
   */
  braces?: number;
  /** Clear ground kept between sections that are not joined; 0: they may stand wall to wall, but never a tile apart. */
  spacing: number;
}
