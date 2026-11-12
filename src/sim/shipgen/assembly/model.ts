import type { RoomSpec } from '../plan';
import type { Rng } from '../../rng';
import type { Site } from './lattice';
import type { RegionGrid } from './regions';

/**
 * The assembly model (docs/STATION_FLOW_WHEEL.md, "The assembly model"). A station is composed of
 *   Section     a coherent inhabited mass: a footprint (box, or ring / arc) with an interior scheme
 *   Connection  a corridor between sections (or none: a direct join)
 *   Void        ground kept open on purpose (the clear space off a dock, an open centre)
 *   Attachment  a dock, a bastion
 * Every element paints regions on the one RegionGrid and declares ports; nothing has walls until the grid compiles
 * them, so every join is the wall writer's. A recipe says what joins what; the assembler does the rest.
 */

export type Dir = 'n' | 'e' | 's' | 'w';

/**
 * Where an element starts and which way it runs: local u runs forward along `dir`, v across. (x, y) is the tile at
 * u = 0, v = 0; a two-wide street takes v = -1 and 0.
 */
export interface Frame { x: number; y: number; dir: Dir }

export const at = (f: Frame, u: number, v: number): [number, number] =>
  f.dir === 'e' ? [f.x + u, f.y + v] : f.dir === 'w' ? [f.x - u, f.y + v] : f.dir === 's' ? [f.x + v, f.y + u] : [f.x + v, f.y - u];

/** The box u0 <= u < u1, v0 <= v < v1 of a frame as x0, y0, x1, y1. */
export function rect(f: Frame, u0: number, u1: number, v0: number, v1: number): [number, number, number, number] {
  const [ax, ay] = at(f, u0, v0), [bx, by] = at(f, u1 - 1, v1 - 1);
  return [Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx) + 1, Math.max(ay, by) + 1];
}

/** The way a room on side `side` (v below or above the street) of a frame faces. */
export const facing = (f: Frame, side: -1 | 1): Dir => (f.dir === 'e' || f.dir === 'w' ? (side < 0 ? 'n' : 's') : side < 0 ? 'w' : 'e');

export interface Port {
  frame: Frame;
  /** end: where a street stops; side: off the side of a corridor; rim: the outside of a ring; tip: the cut end of an arc. */
  kind: 'end' | 'side' | 'rim' | 'tip';
  /** The hall behind it (what a room placed here opens onto). */
  hall: number;
  /** The element that owns it, and how far along that element it is. */
  owner: number;
  along: number;
  side: -1 | 0 | 1;
  used: boolean;
  /** Rooms stand either side of it (the flank of a block): what joins here starts its own rooms a tile further out. */
  flank?: boolean;
  /** The width of the street that ends here, when not two. */
  width?: number;
  /** On the flank of a hall where streets meet: where wings join. */
  node?: boolean;
}

export interface Built {
  ports: Omit<Port, 'owner' | 'used'>[];
  /** Regions it made. */
  regions: number[];
  /** Its extent, x0, y0, x1, y1. */
  box: [number, number, number, number];
  /** Cabins it took of those it was offered. */
  took?: number;
  /** A corridor's run, so an unused tail can be cut back. */
  run?: { frame: Frame; length: number; hall: number };
}

export interface Ctx {
  g: RegionGrid;
  /** The grid as a site, for the shared room-lining code. */
  site: Site;
  rng: Rng;
  /** Void: tiles kept open (the clear space off a dock). */
  reserved: Set<number>;
  /** Ground nothing stands on and nothing has reserved. */
  free: (x: number, y: number) => boolean;
  /** On the grid, a margin in from its edge: nothing is ever placed off it. */
  inside: (x: number, y: number) => boolean;
}

export const key = (x: number, y: number): number => (y + 2048) * 4096 + x + 2048;

/** Rooms dealt to the two sides of a street, each next one to the shorter side, order kept. */
export function sides(rooms: readonly RoomSpec[]): [RoomSpec[], RoomSpec[]] {
  const out: [RoomSpec[], RoomSpec[]] = [[], []];
  const len = [0, 0];
  for (const r of rooms) {
    const k = (len[0] as number) <= (len[1] as number) ? 0 : 1;
    out[k].push(r);
    len[k] = (len[k] as number) + r.w + 1 + (r.annex ? r.annex.w + 1 : 0);
  }
  return out;
}
