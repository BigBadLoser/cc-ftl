"""Tan's ramp designs: a blue line along the wall, then a block of pale cushions in joints under a px wide (the
block's outer joints a step darker, its outer corners curved, the cushions' other corners rounded), then the blue
toe. A design is a layout of cushions over the block."""
import math

from .. import wall3d as T
from ..relief_style import Design
from .parts import LINE, PAINT

FACE = "rose"                                   # the face's family (its second tone: the wall family the cushions')
BLUE = "ochre"                                  # the trim's: the line along the wall, the toe
EDGE = 0.4 / 32                                 # (a px down the slope, about: 2.5 a cell)
CURVE = 3                                       # the block's outer corners: their curve's radius, in px
OUTER = "fTS7"                                  # the block's outer joints (its sides, over the toe; a px): a step darker
INNER = "fTS8"                                  # the joints between its cushions
GAP = 0.7                                       # the inner joints' width, in px (under one: AA softens them)
CUT_D = 0.55
ROUND = 2                                       # a cushion's other corners: rounded on it (its joints straight), this
ROUND_TONE = "fTS2"                             # radius in px, in a tone between the cushion's and the joints'

# a layout: its cushions, each one or more rects (u0, u1, d0, d1, corners) as fractions of the tile (u) and of the
# block's run (d), the corners to round of a (u0, d0) b (u1, d0) c (u1, d1) d (u0, d1) (one on the block's outline
# curved); a u given as a list ([u]) runs under the cushion's other rect there, with no joint
BASE = (((0.25, 0.5, 0.0, CUT_D, "abcd"),), ((0.5, 0.75, 0.0, CUT_D, "abcd"),),    # two squares against the wall, an
        ((0.0, 0.25, 0.0, 1.0, "abd"), ([0.125], 0.5, CUT_D, 1.0, "bc")),         # L either side of them (down the
        ((0.75, 1.0, 0.0, 1.0, "abc"), (0.5, [0.875], CUT_D, 1.0, "ad")))         # tile's side, in along the toe)
THIRDS = (0.0, 1 / 3, 2 / 3, 1.0)
GRID = tuple(((THIRDS[i], THIRDS[i + 1], g0, g1, "abcd"),) for i in range(3) for g0, g1 in ((0.0, 0.5), (0.5, 1.0)))
TALL = tuple(((THIRDS[i], THIRDS[i + 1], 0.0, 1.0, "abcd"),) for i in range(3))


def _raw(f):
    return isinstance(f, list)


def cushions(layout):
    """A ramp design (relief_style.Design's ramp slot) laying the cushions of layout over the block."""
    def ramp(plate, u0, u1, run_, k=None, pt=None, ax="y", **_):
        w, E, L = u1 - u0, EDGE, LINE
        top, end = 0.02 + E, run_ - 0.045               # (under the blue line; the block's end, over the toe)
        nrm = (pt(0.0, 0.0, 1.0) - pt(0.0, 0.0, 0.0)).normalized()
        JL, JE = GAP * L, GAP * E
        span = end - E - top                            # (the block's foot over the toe: a whole px)
        sh = T.SHELL                                    # (the block's sides: half a px each at a tile edge, the
        free = [bool(getattr(sh, "is_end", None) and sh.is_end(ax, u, sd)) for u, sd in ((u0, -1), (u1, 1))]
        side = [L if f else L / 2 for f in free]        # tiles' halves one px; a whole one at a free end)

        def q(ua, ub, da, db):
            return [(ua, da), (ub, da), (ub, db), (ua, db)]

        def U0(f):
            return u0 + f[0] * w if _raw(f) else u0 + f * w + (side[0] if f == 0.0 else JL / 2)

        def U1(f):
            return u0 + f[0] * w if _raw(f) else u0 + f * w - (side[1] if f == 1.0 else JL / 2)

        def D0(g):                                      # (none against the wall)
            return top + g * span + (0.0 if g == 0.0 else JE / 2)

        def D1(g):
            return top + g * span - (0.0 if g == 1.0 else JE / 2)

        def arc(x, y, sx, sy, rad, el=0.0, ee=0.0):    # (a corner (x, y), the rect inward along sx, sy: a quarter
            rl, re = rad * L + el, rad * E + ee         # circle rad px round it (and el, ee more), from its side
            cx, cy = x + sx * rl, y + sy * re
            pts = [(cx - sx * rl * math.cos(t), cy - sy * re * math.sin(t)) for t in (i * math.pi / 12 for i in range(7))]
            return pts if sx * sy > 0 else pts[::-1]   # along d to along u)
        fillets = []

        def rect(f0, f1, g0, g1, rc):                   # (a cushion's rect, the corners rc rounded)
            ua, ub, da, db = U0(f0), U1(f1), D0(g0), D1(g1)
            out = []
            for ch, (x, y, sx, sy, f, g) in zip("abcd", ((ua, da, 1, 1, f0, g0), (ub, da, -1, 1, f1, g0),
                                                         (ub, db, -1, -1, f1, g1), (ua, db, 1, -1, f0, g1))):
                outl = not _raw(f) and f in (0.0, 1.0) and g in (0.0, 1.0)
                if ch in rc and outl:                   # (the block's outer corners: cut on a curve)
                    out += arc(x, y, sx, sy, CURVE)
                    continue
                out.append((x, y))
                if ch in rc:                            # (the others: square, a round shaded on them)
                    fillets.append([(x, y)] + arc(x, y, sx, sy, ROUND))
            return out
        plate(q(u0, u1, 0.0, run_ - 1 / 32), PAINT / 2, 2, 0.0, BLUE)       # the blue: a line under the lip, the
        out = []                                                            # toe band, round the block's corners
        for x, y, sx, sy, el, ee in ((u0, top, 1, 1, side[0], 0.0), (u1, top, -1, 1, side[1], 0.0),
                                     (u1, end, -1, -1, side[1], E), (u0, end, 1, -1, side[0], E)):
            out += arc(x, y, sx, sy, CURVE, el, ee)     # (the outline round the cushions' curves)
        T.plate(k, out, pt, nrm, 0.0, PAINT, FACE, 0, PAINT / 2, fixed=OUTER)   # the joints, under the
        ulo, uhi, dhi = u0 + L, u1 - L, top + span - 2 * E                  # cushions: the block's outline, the
        for cu in layout:                                                   # inner ones lighter along each
            for f0, f1, g0, g1, _rc in cu:                                  # cushion's inner edges
                for f, on in ((f0, 0.0 < (f0 if not _raw(f0) else 0.0) < 1.0), (f1, not _raw(f1) and 0.0 < f1 < 1.0)):
                    if on:
                        um = u0 + f * w
                        da, db = max(top, top + g0 * span - 2 * E), min(dhi, top + g1 * span + 2 * E)
                        T.plate(k, q(um - 2 * L, um + 2 * L, da, db), pt, nrm, 0.0, 1.5 * PAINT, FACE, 0, PAINT,
                                fixed=INNER)
                for g in (g0, g1):
                    if 0.0 < g < 1.0:
                        dm = top + g * span
                        ua = max(ulo, (u0 + f0[0] * w if _raw(f0) else u0 + f0 * w) - 2 * L)
                        ub = min(uhi, (u0 + f1[0] * w if _raw(f1) else u0 + f1 * w) + 2 * L)
                        T.plate(k, q(ua, ub, dm - 2 * E, dm + 2 * E), pt, nrm, 0.0, 1.5 * PAINT, FACE, 0, PAINT,
                                fixed=INNER)
        for cu in layout:
            for f0, f1, g0, g1, rc in cu:
                plate(rect(f0, f1, g0, g1, rc), 2 * PAINT, 2, PAINT, "wall")
        for poly in fillets:
            T.plate(k, poly, pt, nrm, 0.0, 3 * PAINT, FACE, 0, 2 * PAINT, fixed=ROUND_TONE)
    return ramp


TAN_RAMPS = (Design("cushions", ramp=cushions(BASE)), Design("grid", ramp=cushions(GRID)),
             Design("tall", ramp=cushions(TALL)))
