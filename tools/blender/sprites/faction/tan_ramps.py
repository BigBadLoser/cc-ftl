"""Tan's ramp designs: a blue line along the wall, then a block of pale cushions in joints under a px wide (the
block's outer joints a step darker, its outer corners curved, the cushions' other corners rounded), then the blue
toe. A design is a layout of cushions over the block."""
import math

from .. import wall3d as T
from ..relief_style import Design
from .parts import LINE, PAINT, PX

FACE = "rose"                                   # the face's family (its second tone: the wall family the cushions')
BLUE = "ochre"                                  # the trim's: the line along the wall, the toe
EDGE = 0.4 / 32                                 # (a px down the slope, about: 2.5 a cell)
CURVE = 3                                       # the block's outer corners: their curve's radius, in px
OUTER = "fTS4"                                  # the block's outer joints (its sides, over the toe; a px), as the inner ones
INNER = "fTS4"                                  # the joints between its cushions
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
MIRRORED = (((0.0, 0.25, 0.0, CUT_D, "abcd"),), ((0.75, 1.0, 0.0, CUT_D, "abcd"),),     # the base with each half
            ((0.25, 0.5, 0.0, 1.0, "abc"), (0.0, [0.375], CUT_D, 1.0, "ad")),          # mirrored: the squares at
            ((0.5, 0.75, 0.0, 1.0, "abd"), ([0.625], 1.0, CUT_D, 1.0, "bc")))          # the tile's sides, the Ls
THIRDS = (0.0, 1 / 3, 2 / 3, 1.0)                                                       # in the middle
GRID = tuple(((THIRDS[i], THIRDS[i + 1], g0, g1, "abcd"),) for i in range(3) for g0, g1 in ((0.0, 0.5), (0.5, 1.0)))
TALL = tuple(((THIRDS[i], THIRDS[i + 1], 0.0, 1.0, "abcd"),) for i in range(3))


def _raw(f):
    return isinstance(f, list)


def cushions(layout, extra=None):
    """A ramp design (relief_style.Design's ramp slot) laying the cushions of layout over the block; extra(paint,
    solid, U, D) adds more (paint(poly as (u, d), tone, rise in PAINTs); solid(poly, rise, top tone): a raised part;
    U, D a fraction of the tile / the run)."""
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
        if extra:                                       # (paint: flat, rise in PAINTs; solid: a part rise proud
            extra(lambda poly, tone, rise: T.plate(k, poly, pt, nrm, 0.0, rise * PAINT, FACE, 0, (rise - 0.25) * PAINT,
                                                   fixed=tone),                    # of the slope, its top in a tone,
                  lambda poly, rise, top_, fam="wall", lvl=2: T.plate(k, poly, pt, nrm, 0.0, rise, fam, lvl, PAINT,
                                                                       fixed=top_),     # its sides lit as they face)
                  lambda f: u0 + f * w, lambda g: top + g * span)
    return ramp


# the grille design: a wide cushion, then an air vent sunk a px into the slope between it and a narrow one: slats down
# the slope over its left two thirds (their tops pale, a mid tan between them, the last one lit along its right), the
# rest of its floor plain in shadow; its inner walls along its top and left (the ones seen) dark
G_L, G_R = 8 / 32, 25 / 32                      # the vent, across the tile
G_D0, G_D1 = 0.04, 0.96                         # and down the slope
G_SLATS = 0.62                                  # the slats' share of it, from its left
G_H = PX / 4                                    # the slats' height


def grille(paint, solid, U, D):
    L, E = LINE, EDGE

    def q(ua, ub, da, db):
        return [(ua, da), (ub, da), (ub, db), (ua, db)]
    gu0, gu1, gd0, gd1 = U(G_L) + L / 2, U(G_R) - L / 2, D(G_D0), D(G_D1)         # (a joint in from the cushions)
    gs = gu0 + G_SLATS * (gu1 - gu0)
    paint(q(gu0, gu1, D(0.0), D(1.0)), "fTS3", 1.75)                                # its surround
    paint(q(gs, gu1, gd0, gd1), "fTS3", 2.0)                                        # its floor in shadow
    paint(q(gu0, gs, gd0, gd1), "fTS2", 2.0)                                        # mid tan under the slats
    n = int((gs - gu0) / (2 * L))
    for i in range(n):                                                              # the slats (a px, every two)
        ua = gu0 + (2 * i + 1) * L
        solid(q(ua, ua + L, gd0 + E, gd1), G_H, "fTW0", FACE, 4)
    paint(q(gs - L, gs, gd0 + E, gd1), "fTW0", 3.0)                                 # the last one lit
    paint(q(gu0, gu1, gd0, gd0 + E), "fTS5", 3.0)                                   # its top inner wall (under the
    paint(q(gu0, gu0 + L, gd0, gd1), "fTS4", 3.0)                                   # slope's edge) and its left


GRILLE = (((0.0, G_L, 0.0, 1.0, "abcd"),), ((G_R, 1.0, 0.0, 1.0, "abcd"),))


TAN_RAMPS = (Design("cushions", ramp=cushions(BASE)), Design("grid", ramp=cushions(GRID)),
             Design("mirrored", ramp=cushions(MIRRORED)), Design("tall", ramp=cushions(TALL)),
             Design("grille", ramp=cushions(GRILLE, grille)))
