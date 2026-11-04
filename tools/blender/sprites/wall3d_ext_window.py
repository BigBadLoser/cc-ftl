"""The exterior hull's window (after Space Haven's hull windows): a straight run's design over two or more tiles, an
end piece at each end (W1 the run's start, W3 its end) and middle pieces (W2) between. The base hull (wall3d_ext_t3's
section) cut down to: a sill (the upright part, cut low, its top sloping up to the glass), the glass a little behind
the armour's own face, and a header over it (the lean's top 5 px, then upright; its underside flat). An end piece
keeps a post of the whole base section at its outer end, its side facing the window lit.

Measured off the reference (its top and the upright part's front sit where the base hull's do; the section off the
pieces' cut sides): the header's foot 21 px down the base lean's front; the glass 3 px behind the armour's face; the
sill's front 25 px tall, its top rising 7.5 px to the glass; W1's post 4 px."""
import math

from . import core
from . import wall3d as T
from . import wall3d_ext_t3 as T3
from .wall3d_ext_geom import LEAN_RISE, YS, D, Face, Section

PART = None                         # the piece being built: "w1" | "w2" | "w3" (None: not a window)
HEAD = 21                           # the header: the lean's top this many px on screen (down its front)
GLASS_IN = 3 / 32                   # the glass this far behind the armour's own face
SILL = 25                           # the sill's front, px tall
SILL_RISE = 7.5                     # its top's rise from the front to the glass, px of height
POST = 4 / 32                       # an end piece's post (the whole base section), along the face
BEVEL = 5 / 32                      # the header: its lean only this far out from the top's front edge, then cut
                                    # upright (its front)
POST_SIDE = "hsXL"                  # the post's side facing the window (one plane: one tone, between the fronts')
HEAD_FRONT = YS[4]                  # the header's upright front (a step under the lean over it)
GLASS = "glassD"


def build(k, ax, plane, a, b, ends, H):
    s = Section(H, T3.BACK)
    f = Face(k, ax, plane, a, b, ends, s, T3.CORNER_C)
    zb, fr = s.zb, D + T3.BACK                          # (fr: the upright part's front, out from the block's face)
    zh = s.z_at(H, HEAD)                                # the header's foot
    zs = SILL / core.ZPX                                # the sill's front top, and its top at the glass
    gl = T3.BACK - GLASS_IN
    zg = zs + SILL_RISE / core.ZPX
    for s0, s1 in T.spans(a, b):
        w0, w1 = s0, s1
        if PART == "w1":                                # the post
            for z0, z1 in ((0.0, zb), (zb, H)):
                pf = s.sec(z0, z1)
                f.part(s0, s0 + POST, pf, s.cols(pf, "face"), (None, POST_SIDE), end=False)
            w0 = s0 + POST
        pf = [(0.0, 0.0), (fr, 0.0), (fr, zs), (gl, zg), (0.0, zg)]     # the sill
        f.part(w0, w1, pf, s.cols(pf, "face"), None, end=False)
        dv = T3.BACK + BEVEL                                            # the header: the lean's top, then
        zc = H - LEAN_RISE * BEVEL / D                                  # upright down to its foot
        pf = [(0.0, zh), (dv, zh), (dv, zc), (T3.BACK, H), (0.0, H)]
        cols = s.cols(pf, "face")
        cols[1] = HEAD_FRONT
        f.part(w0, w1, pf, cols, None, end=False)
        f.part(w0, w1, [(0.0, zg), (gl, zg), (gl, zh), (0.0, zh)], [GLASS] * 4, None, end=False)   # the glass
