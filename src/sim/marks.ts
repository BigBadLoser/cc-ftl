import type { GridLike } from './grid';

/**
 * Deck markings: paint on a floor tile along its edges (a walkway line, a hazard band, a keep-clear box). Each kind is a per-tile
 * edge mask in its own grid field (`MARK_FIELDS`): a set bit means a line runs along that edge of the tile, `MARK_INSET` in from it.
 * Corners, T-joins and ends need no piece of their own: the renderer (render/deckMarks.ts) draws each quarter of a tile from its own
 * two edge bits and its neighbours' masks. Looks only: nothing in the sim reads them; whatever lays out a ship or station stamps them.
 *
 * This module is the one owner of the constants. The station generator's `shipgen/markings.ts` (a branch that derives these masks
 * from a layout) has the same bit values, kind names and insets, and should import them from here instead of redefining them.
 */

/** Edge bits of a mask: N is -y, E +x, S +y, W -x. */
export const N = 1, E = 2, S = 4, W = 8;

export type EdgeMarking = 'walkway' | 'apron' | 'keepClear' | 'hazard';
export const EDGE_MARKINGS: readonly EdgeMarking[] = ['walkway', 'apron', 'keepClear', 'hazard'];

/**
 * How far in from its edge each kind's line is drawn, as a fraction of a tile (0 on the edge, 0.5 the tile's middle): the masks say
 * which edge, the renderer offsets toward the tile's centre by this. A wall's base hides a line drawn right on the edge. The art
 * draws these as whole cells of the 64-cell tile (walkway 16, the others 6), so they are fixed together with the sprite family
 * `deck_marks` (tools/blender/sprites/deck_marks.py).
 */
export const MARK_INSET: Readonly<Record<EdgeMarking, number>> = { walkway: 0.25, apron: 0.1, keepClear: 0.1, hazard: 0.1 };

/**
 * Keep-clear only: set on every tile inside a box (edge tiles too), the edge bits being set only where the box ends. The box's
 * interior tiles have mask 0, so this is what tells the renderer to hatch them. Above the four edge bits.
 */
export const MARK_FILL = 16;
/** The edge bits of a stored mark byte. */
export const MARK_EDGES = N | E | S | W;

/** The tile field holding each kind's mask (declared in structure.ts SHIP_FIELDS). */
export const MARK_FIELDS = { walkway: 'markWalkway', apron: 'markApron', keepClear: 'markKeepClear', hazard: 'markHazard' } as const satisfies Record<EdgeMarking, string>;

/** The mask of a kind on a tile (0 off the grid). */
export function markAt(grid: GridLike, kind: EdgeMarking, x: number, y: number): number {
  return grid.inBounds(x, y) ? grid.get(MARK_FIELDS[kind], x, y) : 0;
}

/** Set a kind's mask on a tile (edge bits, plus `MARK_FILL` for a keep-clear tile inside a box). 0 clears it. */
export function setMark(grid: GridLike, kind: EdgeMarking, x: number, y: number, mask: number): void {
  grid.set(MARK_FIELDS[kind], x, y, mask & (MARK_EDGES | (kind === 'keepClear' ? MARK_FILL : 0)));
}
