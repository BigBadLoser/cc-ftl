import type { Dept } from './dept';
import type { HubOpts } from './hub';
import type { Outline } from './lattice';
import type { Dir } from './model';
import type { QuayOpts } from './quay';
import type { Gap } from './ring';
import type { RoomRole } from '../types';

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
   * end, on a ring's inner side heading for its centre (`spoke`, from the sides named), at the far end of another rule's branch (its index in `branches`), or on the end or side of any section
   * already standing, the newest first (a cluster that grows), or on a flank along the street as the seed picks it, a hall's
   * more often than a section's.
   */
  host: { on: 'trunk' } | { on: 'rim'; prefer: readonly Dir[]; roll?: boolean } | { on: 'tip' } | { on: 'spoke'; side: readonly Dir[] } | { on: 'after'; rule: number } | { on: 'section' } | { on: 'flank' };
  /** Corridor before the first section (0: joined directly). On a ring's rim the band's depth is added. */
  neck: Roll;
  /**
   * A dogleg in the neck: it steps this many tiles sideways halfway along, to either side as the seed has it, so the
   * section stands off its host's line. Under two it runs straight; a range makes some necks straight and some not.
   */
  jog?: Roll;
  /**
   * Its neck and its links are halls, not corridors: each a room-sized piece of street this wide (and as long as the
   * neck or link), with a port on each flank for a wing. The street beyond leaves it `shift` tiles to one side, either
   * way as the seed has it: the step that keeps a long street from being one straight line.
   */
  hall?: { wide: Roll; shift?: Roll };
  /** Rooms dealt to sections at random across the departments it takes, each section its own branch (scrappers). */
  mix?: boolean;
  /** Sections on one branch at most; a department with more gets another branch. Default: all on one. */
  most?: number;
  /** A gate at the foot: a controlled department. Hard: nothing else joins a gated branch or stands against it. */
  gated?: boolean;
  /**
   * Its sections: rooms in each, one floor depth for a slab or the rooms' own for staggered bays, a room across the
   * last one's end (the biggest, or the first of a role), and the street's width (default 2), and roles that stand at the far end of its rows.
   * `behind`: rooms of these departments stand behind the rows, one a side and as long as the street (sheds behind shops).
   */
  section: { rooms: readonly [number, number]; rowDepth?: number; cap?: boolean | RoomRole; even?: boolean; cross?: boolean | 'any' | 'end' | 'inner' | readonly ('end' | 'inner')[]; width?: number; far?: readonly RoomRole[]; behind?: readonly Dept[] };
  /** Corridor between one section and the next (0: joined directly). */
  link: Roll;
  /** The station's docks stand in this branch's first section (a dock block). Hard: every dock must stand. */
  docks?: boolean;
  /** With `docks`: the docks and the first section's rooms stand as a quay (quay.ts) in place of the dock block. */
  quay?: QuayOpts;
}

export interface Recipe {
  name: string;
  root:
    /** A trunk corridor: everything hangs off its sides. `pairs`: chance a branch stands opposite the one before; `step`: trunk between one branch and the next. */
    | { kind: 'trunk'; pairs: number; step: Roll }
    /** No root of its own: the first branch stands at the centre and the rest grow from the sections. */
    | { kind: 'core' }
    /**
     * A ring or an arc with its band: it takes these departments itself. `cut` 'octagon': a square outline cut to
     * eight even sides, whatever its size; `{ flat }`: cut so each side keeps that many cells of flat either side of its
     * axis (rounder as the number falls). With `round` the cut corners are arcs; with `shoulders` the ends of each arc
     * are the band's (rooms stand there) and only its steep middle is one corner room. `waterfront`: rooms of these
     * departments stand on the ring's inner side first, shared between the two faces beside an arc's gap. `hub`: a market court at its centre with spokes to the ring (hub.ts); the
     * `market` departments stand round the court, the `gated` ones line the north and south spokes behind gates, and
     * of the `spokes` ones (which the ring takes too) as many line the east and west spokes as fit.
     */
    | { kind: 'ring'; takes: readonly Dept[]; outline: Outline; cut: number | 'octagon' | { flat: number }; round?: boolean; shoulders?: boolean; inner: boolean; waterfront?: readonly Dept[]; gap?: Gap; hub?: HubOpts & { market: readonly Dept[]; spokes: readonly Dept[]; gated?: readonly Dept[] } };
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
