import { E, MARK_FIELDS, MARK_FILL, N, S, W, type EdgeMarking } from "../sim/marks";

/**
 * Deck markings, drawn a quarter of a tile at a time (sprite family `deck_marks`, tools/blender/sprites/deck_marks.py, which
 * lists the cases). A quarter's piece depends only on its tile's two edge bits on the quarter's own sides, on the masks of the
 * tiles across them and, to tell where a hazard band really ends, on the diagonal one, so any shape of line joins exactly.
 */

/** The kinds that have art (the door apron is stored but not drawn: doors carry hazard striping). */
export const DRAWN_MARKINGS: readonly EdgeMarking[] = ["walkway", "hazard", "keepClear"];
/** Sprite id stem of each drawn kind. */
const STEM: Readonly<Partial<Record<EdgeMarking, string>>> = { walkway: "walkway", hazard: "hazard", keepClear: "keep" };

/** The walkway line's default paint: the study's cream (palette_extra lvW). The line is grey art painted by this (carpetPaint.ts). */
export const WALKWAY_PAINT = 0xd6d1c2;

/** Mask of a kind at a tile offset from the one drawn (0 where nothing is stored). */
export type MaskAt = (dx: number, dy: number) => number;

/** The quarters: qi 1 = the +x half (east), qj 1 = the +y half (south); `i` and `j` are the bits of the quarter's two sides. */
const QUARTERS = [
  { quad: "nw", dx: -1, dy: -1, i: W, j: N },
  { quad: "ne", dx: 1, dy: -1, i: E, j: N },
  { quad: "sw", dx: -1, dy: 1, i: W, j: S },
  { quad: "se", dx: 1, dy: 1, i: E, j: S },
] as const;
const OPPOSITE: Readonly<Record<number, number>> = { [N]: S, [S]: N, [E]: W, [W]: E };

/**
 * The case of one quarter (see deck_marks.py): "i" / "j" a straight line along its x-side / y-side edge, "ij" both (an inside
 * corner), "n" a turn round a wall's outer corner (neither bit, but the tiles across both edges carry the other's bit; for a
 * keep-clear box only inside it), "ic" / "jc" a hazard band that stops at the quarter's far edge, "" none.
 */
export function quarterCase(kind: EdgeMarking, at: MaskAt, q: (typeof QUARTERS)[number]): string {
  const own = at(0, 0);
  const bi = own & q.i;
  const bj = own & q.j;
  if (bi && bj) return "ij";
  const ni = at(q.dx, 0);
  const nj = at(0, q.dy);
  const nd = at(q.dx, q.dy);
  // A hazard band running on past the quarter's far edge, or turning round a wall corner there, has no end.
  if (bi) return kind === "hazard" && !(nj & q.i) && !(nd & OPPOSITE[q.j]!) ? "ic" : "i";
  if (bj) return kind === "hazard" && !(ni & q.j) && !(nd & OPPOSITE[q.i]!) ? "jc" : "j";
  if (ni & q.j && nj & q.i && (kind !== "keepClear" || own & MARK_FILL)) return "n";
  return "";
}

/** Sprite ids of a kind's pieces on one tile (up to four, one per quarter with something in it). */
export function markPieces(kind: EdgeMarking, at: MaskAt): string[] {
  const stem = STEM[kind];
  if (!stem) return [];
  const fill = kind === "keepClear" && (at(0, 0) & MARK_FILL) !== 0;
  const out: string[] = [];
  for (const q of QUARTERS) {
    const c = quarterCase(kind, at, q);
    if (!c && !fill) continue;
    out.push(["tile.mark", stem, c, fill ? "f" : "", q.quad].filter(Boolean).join("."));
  }
  return out;
}

/** Every grid field the markings drawn on a tile read (for chunk revision keys). */
export const MARK_DRAWN_FIELDS: readonly string[] = DRAWN_MARKINGS.map((k) => MARK_FIELDS[k]);
