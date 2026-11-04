"""Tan's ramp designs: a blue line along the wall, then a block of pale cushions in joints under a px wide (the
block's outer joints a step darker, its outer corners curved, the cushions' other corners rounded), then the blue
toe. A design is a layout of cushions over the block."""
import math

from mathutils import Vector

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


def _corner(w):
    """The layout by an outer corner, on a face w of a tile: the base's far half at its own size (the L, the square),
    a plain plate on to the corner's ridge."""
    t = 1.0 / w
    return (((0.25 * t, 0.5 * t, 0.0, CUT_D, "abcd"),), ((0.0, 0.25 * t, 0.0, 1.0, "abd"), ([0.125 * t], 0.5 * t, CUT_D, 1.0, "bc")),
            ((0.5 * t, 1.0, 0.0, 1.0, "ad"),))


RIDGE_EDGE = {"y": "fTE0", "x": "fTE0"}         # the plates' pale edge either side of the ridge, a px (not anti-aliased)
THIRDS = (0.0, 1 / 3, 2 / 3, 1.0)                                                       # in the middle
GRID = tuple(((THIRDS[i], THIRDS[i + 1], g0, g1, "abcd"),) for i in range(3) for g0, g1 in ((0.0, 0.5), (0.5, 1.0)))
TALL = tuple(((THIRDS[i], THIRDS[i + 1], 0.0, 1.0, "abcd"),) for i in range(3))


def _raw(f):
    return isinstance(f, list)


def cushions(layout, extra=None):
    """A ramp design (relief_style.Design's ramp slot) laying the cushions of layout over the block; extra(paint,
    solid, U, D, sd) adds more (paint(poly as (u, d), tone, rise in PAINTs); solid(poly, rise, top tone): a raised part;
    U, D a fraction of the tile / the run)."""
    def ramp(plate, u0, u1, run_, k=None, pt=None, ax="y", plane=None, **_):
        w, E, L = u1 - u0, EDGE, LINE
        top, end = 0.02 + E, run_ - 0.045               # (under the blue line; the block's end, over the toe)
        nrm = (pt(0.0, 0.0, 1.0) - pt(0.0, 0.0, 0.0)).normalized()
        JL, JE = GAP * L, GAP * E
        span = end - E - top                            # (the block's foot over the toe: a whole px)
        sh = T.SHELL                                    # (the block's sides: half a px each at a tile edge, the
        free = [bool(getattr(sh, "is_end", None) and sh.is_end(ax, u, sd)) for u, sd in ((u0, -1), (u1, 1))]
        side = [L if f else L / 2 for f in free]        # tiles' halves one px; a whole one at a free end)
        ln = getattr(sh, "line", None)                  # (at an outer corner's ridge (tan.RampRidge): the corner
        corner = bool(ln and getattr(sh, "band", 0.0)   # layout, square at the ridge)
                      and abs(u1 - ((ln[0] if ax == "y" else ln[1]) - sh.band)) < 1e-6)
        e = 1e-3                                        # (at an inner corner's crease: one plain plate, square
        inner = bool(plane is not None and hasattr(sh, "_rect_at") and   # at the crease, run on into it)
                     sh._rect_at(*((u0 - e, plane + e) if ax == "y" else (plane + e, u0 - e)), 0.0) is not None)
        lay = _corner(w) if corner and layout is BASE else layout
        if inner and layout is BASE:
            lay = (((0.0, 1.0, 0.0, 1.0, "bc"),),)
        if corner:
            side[1] = 0.0                               # (no joint at the ridge: the plate's pale edge)

        def q(ua, ub, da, db):
            return [(ua, da), (ub, da), (ub, db), (ua, db)]

        def run_on(poly):                               # (at the ridge the slope's edge runs out with d, the
            out_ = []                                   # chamfer's edges straight at the camera: a part ending
            for x, y in poly:                           # there runs on with it; at a crease the slope starts past
                if corner and min(abs(x - u1), abs(x - u1 + L)) < 1e-9:     # it, as far out)
                    x += y
                elif inner and u0 - 1e-9 <= x <= u0 + L + 1e-9:
                    x = min(x + y, u1)
                out_.append((x, y))
            return out_

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
        plate(run_on(q(u0, u1, 0.0, run_ - 1 / 32)), PAINT / 2, 2, 0.0, BLUE)       # the blue: a line under the lip, the
        out = []                                                            # toe band, round the block's corners
        for x, y, sx, sy, el, ee in ((u0, top, 1, 1, side[0], 0.0), (u1, top, -1, 1, side[1], 0.0),
                                     (u1, end, -1, -1, side[1], E), (u0, end, 1, -1, side[0], E)):
            out += [(x, y)] if (corner and x == u1) or (inner and x == u0) else arc(x, y, sx, sy, CURVE, el, ee)   # (the outline round the
                                                                                            # cushions' curves)
        T.plate(k, run_on(out), pt, nrm, 0.0, PAINT, FACE, 0, PAINT / 2, fixed=OUTER)   # the joints, under the
        ulo, uhi, dhi = u0 + L, u1 - L, top + span - 2 * E                  # cushions: the block's outline, the
        for cu in lay:                                                   # inner ones lighter along each
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
        for cu in lay:
            for f0, f1, g0, g1, rc in cu:
                plate(run_on(rect(f0, f1, g0, g1, rc)), 2 * PAINT, 2, PAINT, "wall")
        if corner:                                      # the plate's pale edge along the ridge
            T.plate(k, run_on(q(u1 - L, u1, D0(0.0), D1(1.0))), pt, nrm, 0.0, 3 * PAINT, FACE, 0, 2 * PAINT,
                    fixed=RIDGE_EDGE[ax])
        for poly in fillets:
            T.plate(k, poly, pt, nrm, 0.0, 3 * PAINT, FACE, 0, 2 * PAINT, fixed=ROUND_TONE)
        if extra:                                       # (paint: flat, rise in PAINTs; solid: a part rise proud
            extra(lambda poly, tone, rise: T.plate(k, poly, pt, nrm, 0.0, rise * PAINT, FACE, 0, (rise - 0.25) * PAINT,
                                                   fixed=tone),                    # of the slope, its top in a tone,
                  lambda poly, rise, top_, fam="wall", lvl=2, base=PAINT, lit=None:
                      _solid(k, poly, pt, nrm, rise, fam, lvl, base, top_, lit),   # (its sides lit as they face; lit:
                                                                                    # the side toward the light's tone)
                  lambda f: u0 + f * w, lambda g: top + g * span, lambda c: _shade(c, ax))
    return ramp


def _solid(k, poly, pt, nrm, rise, fam, lvl, base, top_, lit):
    """T.plate's raised part, its side facing the light (+y) in the tone lit when given (on a shaded face that side
    is the part's lightest)."""
    if lit is None:
        return T.plate(k, poly, pt, nrm, 0.0, rise, fam, lvl, base, fixed=top_)
    topf = [pt(u, dd, rise) for u, dd in poly]
    k.poly(topf, fam, lvl, nrm, fixed=top_)
    cen = sum(topf, Vector()) / len(topf)
    for i in range(len(poly)):
        j = (i + 1) % len(poly)
        p0, p1 = pt(*poly[i], base), pt(*poly[j], base)
        out = (p0 + p1) / 2 - cen + nrm * 0.02
        k.poly([p0, p1, topf[j], topf[i]], fam, lvl, out, fixed=lit if out.normalized().y > 0.7 else None)


RAMP_TONES = ("fTW0", "fTW1", "fTW2", "fTW3")   # the cushions' tones, light to dark (fTW3 their shaded side)


def _shade(name, ax):
    """A design's tone on the shaded (x) face: a step darker, as the cushions beside it are."""
    from .tan import sd
    if ax == "x" and name in RAMP_TONES:
        return RAMP_TONES[min(len(RAMP_TONES) - 1, RAMP_TONES.index(name) + 1)]
    return sd(name, ax)


# the grille design: a wide cushion, then a raised body between it and a narrow one (its sides shaded as they face),
# an air vent sunk a px into its top: a rim of the body round it, slats down the slope standing up from its floor
G_L, G_R = 8 / 32, 25 / 32                      # the body, across the tile
G_D0, G_D1 = 0.03, 0.97                         # and down the slope
G_H, G_SINK = 2 * PX, PX / 2                    # its height; the vent's depth in it (a px)
G_RIM, G_RIM_D = 1.0, 2.0                       # the rim round the vent, in px: at its sides, at its top and foot


def grille(paint, solid, U, D, sd):
    L, E = LINE, EDGE

    def q(ua, ub, da, db):
        return [(ua, da), (ub, da), (ub, db), (ua, db)]
    bu0, bu1, bd0, bd1 = U(G_L) + L / 2, U(G_R) - L / 2, D(G_D0), D(G_D1)          # (a joint in from the cushions)
    bx1 = U(G_R) + GAP * L / 2                                                      # (its right side: on the cushion,
    paint(q(bu0, bx1, D(0.0), D(1.0)), sd("fTS3"), 1.75)                            # no joint) (the slope round it)
    fl = G_H - G_SINK
    LIT = "fTW0" if sd("fTW0") != "fTW0" else None  # (on the shaded face its side toward the light: the lightest)
    solid(q(bu0, bx1, bd0, bd1), fl, sd("fTS2"), FACE, 4, lit=LIT)                  # the body, to the vent's floor
    ru, rd = G_RIM * L, G_RIM_D * E
    vu0, vu1, vd0, vd1 = bu0 + ru, bu1 - ru, bd0 + rd, bd1 - rd                     # the vent
    for ua, ub, da, db in ((bu0, bx1, bd0, vd0), (bu0, bx1, vd1, bd1),             # the rim round it, up to the
                           (bu0, vu0, vd0, vd1), (vu1, bx1, vd0, vd1)):             # body's top
        solid(q(ua, ub, da, db), G_H, sd("fTW2"), FACE, 4, fl, LIT)
    n = int(((vu1 - vu0) / L - 1) / 2)                                              # the slats (a px, a px apart,
    off = vu0 + ((vu1 - vu0) - (2 * n + 1) * L) / 2                                 # centred in it, a gap at each
    for i in range(n):                                                              # side)
        ua = off + (2 * i + 1) * L
        solid(q(ua, ua + L, vd0, vd1), G_H, sd("fTW0"), FACE, 4, fl)


GRILLE = (((0.0, G_L, 0.0, 1.0, "abcd"),), ((G_R, 1.0, 0.0, 1.0, "abcd"),))


TAN_RAMPS = (Design("cushions", ramp=cushions(BASE)), Design("grid", ramp=cushions(GRID)),
             Design("mirrored", ramp=cushions(MIRRORED)), Design("tall", ramp=cushions(TALL)),
             Design("grille", ramp=cushions(GRILLE, grille)))
