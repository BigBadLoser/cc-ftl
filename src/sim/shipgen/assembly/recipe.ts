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
   * end, or at the far end of another rule's branch (its index in `branches`).
   */
  host: { on: 'trunk' } | { on: 'rim'; prefer: readonly Dir[] } | { on: 'tip' } | { on: 'after'; rule: number };
  /** Corridor before the first section (0: joined directly). On a ring's rim the band's depth is added. */
  neck: Roll;
  /** Sections on one branch at most; a department with more gets another branch. Default: all on one. */
  most?: number;
  /** A gate at the foot: a controlled department. Hard: nothing else joins a gated branch. */
  gated?: boolean;
  /** Its sections: rooms in each, one floor depth for a slab or the rooms' own for staggered bays, a room across the last one's end. */
  section: { rooms: readonly [number, number]; rowDepth?: number; cap?: boolean; even?: boolean };
  /**
   * How its sections stand: in series along the branch (beads on a string), or on the sides of one stem corridor (a
   * comb). Default series.
   */
  arrange?: 'series' | 'sides';
  /** Corridor between sections in series; on a stem, the run of stem each section is given. */
  link: Roll;
  /** Chance a later section turns off the side of the link instead of carrying straight on. */
  fork?: number;
  /** The station's docks hang on this branch's corridors (a pier). */
  pier?: boolean;
}

export interface Recipe {
  name: string;
  root:
    /** A trunk corridor: everything hangs off its sides. `pairs`: chance a branch stands opposite the one before; `step`: trunk between one branch and the next. */
    | { kind: 'trunk'; pairs: number; step: Roll }
    /** A ring or an arc with its band: it takes these departments itself. */
    | { kind: 'ring'; takes: readonly Dept[]; outline: Outline; cut: number; inner: boolean; gap?: Gap };
  branches: readonly BranchRule[];
  /** Clear ground kept between sections that are not joined. */
  spacing: number;
}
