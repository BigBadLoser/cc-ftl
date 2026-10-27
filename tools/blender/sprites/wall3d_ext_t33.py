"""The exterior hull's T3-3 top design (after hull 46's variant 03): the base filled out upright, its top edge rounded
onto the top; three columns across it, seams between them up over the rounded edge and back across the top, the
middle one recessed under the upper seam, the side ones a plate a px proud between the seams; vents and a handle on
the side ones. Built through the face builder (wall3d_ext_geom), with T3-2's rounded edge (arc)."""
from . import core
from . import wall3d as T
from .wall3d_ext_geom import LINE, PAINT, YS, D
from .wall3d_ext_t32 import ROUND, T2_SEAM_COLS, T2_TOP, arc

DROP = 1 / 32                       # the box's top this far under the top's (the step up to it lit, this tone; a
T3_STEP = (YS[5], T2_TOP[2])        # px of this one in front of it, its shadow)
T3_OUT = 1                          # the side columns between the seams a plate this many px proud
T3_COLS = (10, 10)                  # px: the left column's width, the right's (the middle between)
T3_SEAMS = (18, 46)                 # px under the front's top: seams right across (a dark px, a lit one under)
T3_RECESS = (2, 2, "hsXM", "hsXS", (4, "hsD"))  # the middle column recessed this many px between lips this many
                                    # px tall over the floor and under the upper seam; its left wall and its lower
                                    # lip's top (the faces seen in it) in this tone, its floor this one; a shadow this
                                    # many px down it from its top (its top edge hides one), this tone
T3_LOW_SEAM = "hsXD"                # the lower seam: a shadow right across (under the plates, the recess's floor)
T3_VENTS = (2, 5, 3, 4, 4, 1)       # on the side columns: slots, px long, px apart; the upper vent's top this many px
                                    # under the upper seam, the lower's foot this many over the floor; px in from the
                                    # column's outer side
T3_HANDLE = (3, 7, 33)              # a handle a px proud on each side column (at its middle): px wide, tall, its top
                                    # px under the front's top (lit down its near side and along its top)


def build(f, s, a, b, H, tone):
    """T3-3 over [a, b] of the face f (section s; tone: a section's tones, its flat tops the top's)."""
    for s0, s1 in T.spans(a, b):
        _box(f, s, s0, s1, H, tone)


def _along(f, v0, v1, pts, col):
    """A painted band over [v0, v1] along a (d, z) polyline on a part's outside (to its right going along)."""
    for (d0, z0), (d1, z1) in zip(pts, pts[1:]):
        nd, nz = z1 - z0, d0 - d1
        k = PAINT / max(1e-9, (nd * nd + nz * nz) ** 0.5)
        f.part(v0, v1, [(d0, z0), (d1, z1), (d1 + nd * k, z1 + nz * k), (d0 + nd * k, z0 + nz * k)], [col] * 4, col,
               end=False)


def _box(f, s, s0, s1, H, tone):
    """The box over [s0, s1]: its columns (T3_COLS), the middle one recessed (T3_RECESS); seams across (T3_SEAMS),
    between the columns over the rounded edge to the top's step, at the recess's far side, and across the top (T3-2's,
    T2_TOP); vents, handles."""
    rim = [(d, z - DROP) for d, z in arc(H, ROUND - LINE)]             # (T3-2's rounded edge)
    top = rim + s.lean(H - DROP)
    zt = rim[0][1]                                                      # (its front's top)

    def at(n):                                                          # (n px under it)
        return zt - n / core.ZPX
    front = tone([(0.0, 0.0), (D, 0.0), (D, at(T3_SEAMS[1])), (0.0, at(T3_SEAMS[1]))])[1]

    step = tuple(top[-2:])

    def part(v0, v1, pf, cap=None, end=False, col=front, edge=None):    # (its front the upright's tone throughout:
        cols = tone(pf)                                                 # a part's by its height would take the
        cols[1] = col                                                   # lean's over the bend; the top's step lit)
        for i in range(len(pf) - 1):
            if (pf[i], pf[i + 1]) == step:
                cols[i] = T3_STEP[0]
        if edge:
            cols[2] = edge
        f.part(v0, v1, pf, cols, cap, end=end)
    deep, over, wall, floor, (shade, shade_col) = T3_RECESS
    dr, up = D - deep * LINE, T3_SEAMS[0] + 2
    c0, c1 = s0 + T3_COLS[0] * LINE, s1 - T3_COLS[1] * LINE
    z0, z1, zl, Dp = over / core.ZPX, at(up), at(T3_SEAMS[1]), D + T3_OUT * LINE
    zr = at(up + over)                                                  # (the recess's top, under its upper lip)
    for v0, v1, end in ((s0, c0, False), (c1, s1, None)):               # the side columns: under the lower seam,
        part(v0, v1, [(0.0, 0.0), (D, 0.0), (D, zl), (0.0, zl)], end=end)  # the plate, over the upper seam (the
        part(v0, v1, [(0.0, zl), (Dp, zl), (Dp, z1), (0.0, z1)], end=end)  # left's side in the recess its wall,
        part(v0, v1, [(0.0, z1), (D, z1)] + top, end=end)                 # painted)
    for pf in ([(dr, z0), (D, z0), (D, zr), (dr, zr)], [(D, zl), (Dp, zl), (Dp, zr), (D, zr)]):
        f.part(c0, c0 + PAINT, pf, [wall] * 4, wall, end=False)
    part(c0, c1, [(0.0, 0.0), (D, 0.0), (D, z0), (0.0, z0)], edge=wall)  # the middle: under the recess, it,
    part(c0, c1, [(0.0, z0), (dr, z0), (dr, zr), (0.0, zr)], col=floor)
    part(c0, c1, [(0.0, zr), (Dp, zr), (Dp, z1), (0.0, z1)])            # its upper lip (proud with the plates),
    part(c0, c1, [(0.0, z1), (D, z1)] + top)                            # over it

    def paint(v0, v1, za, zb, col, d=D):                                # (a painted band on a front)
        f.part(v0, v1, [(d, za), (d + PAINT, za), (d + PAINT, zb), (d, zb)], [col] * 4, col, end=False)
    dark, lit = T2_SEAM_COLS
    px = 1 / core.ZPX
    for n in T3_SEAMS:                                                  # the seams across (on the recess's floor
        for v0, v1, d in ((s0, c0, D), (c0, c1, dr if n > up else D), (c1, s1, D)):     # there; the plates' over
            sh = T3_LOW_SEAM if n > up else dark                        # it; the lower one a shadow all through,
            paint(v0, v1, at(n + 1), at(n), sh, d)                      # a px on the recess's floor: the plates
            if d != dr:                                                 # hide one of theirs)
                paint(v0, v1, at(n + 2), at(n + 1), sh if n > up else lit, d)
    paint(c1 - LINE, c1, z0, zr, dark, dr)                              # (the recess's far side, the shadow under
    paint(c0, c1, zr - shade * px, zr, shade_col, dr)                      # its top)
    dt = -0.5 - f.plane + T2_TOP[1] * LINE                              # (the top's seam: the tile's back edge at
    f.top_line(s0, s1, dt, dt + LINE, T2_TOP[2])                        # -0.5)
    (d0, z), col = step[0], T3_STEP[1]
    f.part(s0, s1, [(d0, z), (d0 + LINE, z), (d0 + LINE, z + PAINT), (d0, z + PAINT)], [col] * 4, col, end=False)
    seam = [(D, at(T3_SEAMS[0]))] + top[:-1]                          # (to the top's step)
    for c in (c0, c1):                                                  # (between the columns: a dark px, a lit
        _along(f, c - LINE, c, seam, dark)                              # one beside)
        _along(f, c, c + LINE, seam[:2], lit)
    n, ln, pitch, under, foot, inset = T3_VENTS
    for v0, v1 in ((s0 + inset * LINE, s0 + (inset + ln) * LINE), (s1 - (inset + ln) * LINE, s1 - inset * LINE)):
        for i in range(n):
            za = at(T3_SEAMS[0] + 2 + under + pitch * i)                # (the upper vent, down; the lower, up)
            paint(v0, v1, za - px, za, dark, Dp)
            za = (foot + pitch * i) * px
            paint(v0, v1, za, za + px, dark)
    hw, ht, hz = T3_HANDLE
    for c in ((s0 + c0) / 2, (c1 + s1) / 2):
        pf = [(Dp, at(hz + ht)), (Dp + LINE, at(hz + ht)), (Dp + LINE, at(hz)), (Dp, at(hz))]
        v0 = c - hw * LINE / 2
        f.part(v0, v0 + hw * LINE, pf, [YS[1], front, YS[4], None], (YS[4], YS[1]), end=False)
        paint(v0, v0 + LINE, at(hz + ht), at(hz), YS[4], Dp + LINE)
