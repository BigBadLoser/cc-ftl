"""Deck markings (family `deck_marks`): paint on the deck along tile edges, drawn a quarter of a tile at a time so any shape of
line, corner, T, diagonal step, gap or box joins exactly. The sim stores one edge mask per kind per tile (src/sim/marks.ts: bits
N 1, E 2, S 4, W 8, `MARK_FILL` 16 for keep-clear); the renderer (src/render/deckMarks.ts) picks each quarter's piece from the
tile's two edge bits on that quarter's sides and its neighbours' masks. Looks picked in the floor look study (floor_study.py):

- walkway = e1: one solid line, 4 cells wide, 16 cells in from the wall. Drawn in the carpet's mid grey (c4H5), for the same
  paint step as the carpet (render/carpetPaint.ts): the renderer paints it cream (the study's lvW) unless a faction or district
  colour is given.
- hazard = z2: a 16-cell band of yellow and dark stripes along x + y, 6 cells in, a thin dark frame line on both its edges; where
  the band stops (a door or room edge beside it) z2b's square end: the band stops 23 cells short of the tile edge, closed by
  the dark frame line across it.
- keep-clear = q1: a 4-cell yellow outline 6 cells in, and a thin dim-ochre hatch along x + y over the box inside it.
- door apron: not drawn (doors already carry hazard striping).

A piece is one quarter (nw, ne, sw, se; e = +x, s = +y) of one case:
  i    the quarter's x-side edge has a line (mask bit W for a west quarter, E for an east one); the line runs along y
  j    its y-side edge has a line (N or S); runs along x
  ij   both: an L, the room's inside corner
  n    neither, but the tiles across both edges carry the other's bit: the line turns round a wall's outer corner
  ic jc  (hazard) the band stops at the quarter's far edge (i: runs along y and ends at its y-side edge)
  f    (keep-clear) the quarter is inside a box: hatched; with a case, hatched past the outline
Distances are Chebyshev cells from the nearest wall (or box edge), as in the study: i a cells from the x-side edge, j b cells
from the y-side edge, ij the smaller, n the larger. Stripes and hatching are global (x + y) patterns of period 32 cells (64 a
tile), so every quarter has the same phase and the pieces are rendered, not rotated or mirrored.

Each is a "decal:<qi><qj>" sprite (env_build.quarter_mask): transparent, only its quarter's px, drawn with a 2-cell margin of the
pattern repeated past the quarter's edges so the px on the seam come out whole. No colours of its own: hazY, hazK, dnW3, ochD, c4H5."""
from . import core

Q = 32                    # cells a quarter side
M = 2                     # margin cells drawn past the quarter's edges
QUADS = {"nw": (0, 0), "ne": (1, 0), "sw": (0, 1), "se": (1, 1)}

WALK_AT, WALK_W = 16, 4                  # the line's inset and width (cells; src/sim/marks.ts MARK_INSET 0.25)
HAZ_AT, HAZ_FRAME, HAZ_BAND = 6, 2, 16   # the band's inset, frame line width and width between the frames (inset 0.1)
HAZ_END = 23                             # the band stops this far short of the tile edge, the frame line closing it
KEEP_AT, KEEP_W = 6, 4                   # the box outline's inset and width; the hatch lies inside it
HATCH_EVERY, HATCH_W = 16, 2


def _edge(case, a, b):
    """Cells in from the nearest wall / box edge: a from the x-side edge, b from the y-side edge."""
    if case == "ij":
        return min(a, b)
    if case == "n":
        return max(a, b)
    return a if case[0] == "i" else b


def walkway(case, a, b, ii, jj, fill):
    return "c4H5" if WALK_AT <= _edge(case, a, b) < WALK_AT + WALK_W else None


def hazard(case, a, b, ii, jj, fill):
    k = _edge(case, a, b) - HAZ_AT
    if not 0 <= k < HAZ_BAND + 2 * HAZ_FRAME:
        return None
    if case == "ic" and b < HAZ_END or case == "jc" and a < HAZ_END:
        return None
    if case == "ic" and b < HAZ_END + 2 or case == "jc" and a < HAZ_END + 2:
        return "dnW3"                                                   # the square end
    if k < HAZ_FRAME or k >= HAZ_FRAME + HAZ_BAND:
        return "dnW3"
    return "hazY" if (ii + jj) % 32 < 16 else "hazK"


def keep(case, a, b, ii, jj, fill):
    e = _edge(case, a, b) if case else 10 ** 9
    if KEEP_AT <= e < KEEP_AT + KEEP_W:
        return "hazY"
    if fill and e >= KEEP_AT + KEEP_W and (ii + jj) % HATCH_EVERY < HATCH_W:
        return "ochD"
    return None


# kind -> (id stem, cell function, [(case, fill)] to render)
KINDS = {
    "walkway": ("walkway", walkway, [(c, 0) for c in ("i", "j", "ij", "n")]),
    "hazard": ("hazard", hazard, [(c, 0) for c in ("i", "j", "ic", "jc", "ij", "n")]),
    "keepClear": ("keep", keep, [(c, 0) for c in ("i", "j", "ij")] + [(c, 1) for c in ("", "i", "j", "ij", "n")]),
}


def piece_id(stem, case, fill, quad):
    return ".".join(["tile.mark", stem] + [p for p in (case, "f" if fill else "") if p] + [quad])


def _quarter(name, fn, case, fill, qi, qj):
    def cell(i, j):
        ii, jj = min(max(i - M, 0), Q - 1), min(max(j - M, 0), Q - 1)       # the margin repeats the edge cells
        a, b = (ii if qi == 0 else Q - 1 - ii), (jj if qj == 0 else Q - 1 - jj)
        return fn(case, a, b, ii, jj, fill)
    m = core.Mesh(name)
    n = Q + 2 * M
    o = (-0.5 + 0.5 * qi - M / 64, -0.5 + 0.5 * qj - M / 64, 0)
    m.pattern(o, (n / 64, 0, 0), (0, n / 64, 0), n, n, cell)
    return [m.build()]


def jobs():
    out = []
    for stem, fn, cases in KINDS.values():
        for case, fill in cases:
            for quad, (qi, qj) in QUADS.items():
                sid = piece_id(stem, case, fill, quad)
                out.append((sid, (1, 1), f"decal:{qi}{qj}",
                            lambda sid=sid, fn=fn, case=case, fill=fill, qi=qi, qj=qj: _quarter(sid, fn, case, fill, qi, qj)))
    return out
