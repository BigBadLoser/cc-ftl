"""The exterior hull's window (after Space Haven's hull windows): a straight run's design over two or more tiles, an
end piece at each end (W1 the run's start, W3 its end) and middle pieces (W2) between. The base hull (wall3d_ext_t3's
section) cut down to: a sill (the upright part, cut low, its top sloping up to the frame's front, flat behind), a
window cut through the wall (a pane of glass in it) and a header over it (the lean's top 5 px, then upright; its
underside flat). An end piece keeps an outer frame of the whole base section at its outer end and the window frame's
side inside it (a jamb, its front the header's). A window piece builds its tile's whole section itself
(wall3d_ext's shell builds nothing for it), its back the wall's: 5 px behind the pane, the pane 5 px behind the
frame's front.

Measured off the reference (its top and the upright part's front sit where the base hull's do; the section off the
pieces' cut sides): the header's foot 21 px down the base lean's front; the sill's front 25 px tall, its top's slope
rising 7.5 px over its depth; W1's outer frame 3 px, its jamb 9 px."""
from . import core
from . import wall3d as T
from . import wall3d_ext_t3 as T3
from .wall3d_ext_geom import LEAN_RISE, YS, D, Face, Section

PART = None                         # the piece being built: "w1" | "w2" | "w3" (None: not a window)
HEAD = 21                           # the header: the lean's top this many px on screen (down its front)
GLASS_IN = 3 / 32                   # the glass this far behind the armour's own face
SILL = 25                           # the sill's front, px tall
SILL_RISE = 7.5                     # its top's slope: its rise from the front to the glass, px of height; cut off
                                    # level with the frame's front (behind it the top flat, to the glass)
SILL_FLAT = "hsXS"                  # that flat (shaded under the header; well under the slope's)
SILL_SLOPE = "hwL"                  # the slope (a white between the jamb's front and the header's lean: the window's
                                    # own tone, palette set "window")
FRAME = 3 / 32                      # an end piece's outer frame (the whole base section), along the face
JAMB = 9 / 32                       # the window frame's side (W1: its left) inside it, along the face: upright from
                                    # the sill to the header, its front the header's
BEVEL = 5 / 32                      # the header: its lean only this far out from the top's front edge, then cut
                                    # upright (its front)
SIDE = "hsXL"                       # the sides facing the window (the outer frame's, the jamb's): one plane, one
                                    # tone, between the fronts'
HEAD_FRONT = YS[4]                  # the header's upright front (a step under the lean over it)
PANE = 1 / 32                       # the glass: a pane this thick, see-through and tinted (its own object: the
                                    # render's glass pass),
PANE_IN = 5 / 32                    # this far behind the frame's front (its centre)
WALL_BACK = 5 / 32                  # the wall's back this far behind the pane (the window cut through to it)
EDGE = YS[0]                        # the pane's edges (all but its two faces): dark and opaque, a hair proud of
EDGE_OUT = 0.002                    # the frame they sit on, so each draws a dark line on it
GLASS = None                        # the pane's builder while a piece is built (its caller renders it apart)


def build(k, ax, plane, a, b, ends, H):
    global GLASS
    from .faction.parts import prism
    s = Section(H, T3.BACK)
    f = Face(k, ax, plane, a, b, ends, s, T3.CORNER_C)
    zb, fr = s.zb, D + T3.BACK                          # (fr: the upright part's front, out from the block's face)
    zh = s.z_at(H, HEAD)                                # the header's foot
    zs = SILL / core.ZPX                                # the sill's front top
    gl = T3.BACK - GLASS_IN
    dv = T3.BACK + BEVEL                                # the header's upright front (and the jamb's)
    zj = zs + SILL_RISE / core.ZPX * (fr - dv) / (fr - gl)   # the sill's top level with it (the slope's top)
    zc = H - LEAN_RISE * BEVEL / D
    dp = dv - PANE_IN                                   # the pane's centre
    db = dp - WALL_BACK                                 # the wall's back (the piece's section reaches back to it)
    GLASS = T.Relief("window_glass")
    for s0, s1 in T.spans(a, b):
        h0, w0, w1 = s0, s0, s1                         # (h0: the header's and the sill's start; w0: the glass's)
        if PART == "w1":
            for z0, z1 in ((0.0, zb), (zb, H)):         # the outer frame: the base section, whole
                pf = s.sec(z0, z1)
                cols = s.cols(pf, "face")
                pf = [(db, pf[0][1])] + pf[1:-1] + [(db, pf[-1][1])]
                f.part(s0, s0 + FRAME, pf, cols, (None, SIDE), end=False)
            pf = [(db, 0.0), (dv, 0.0), (dv, zh), (db, zh)]     # the frame's side (jamb), under the header
            f.part(s0 + FRAME, s0 + FRAME + JAMB, pf, [None, HEAD_FRONT, None, None], (None, SIDE), end=False)
            h0, w0 = s0 + FRAME, s0 + FRAME + JAMB
        pf = [(db, 0.0), (fr, 0.0), (fr, zs), (dv, zj), (db, zj)]       # the sill: its slope, then flat back
        cols = s.cols(pf, "face")
        cols[2], cols[3] = SILL_SLOPE, SILL_FLAT
        f.part(h0, w1, pf, cols, None, end=False)
        pf = [(db, zh), (dv, zh), (dv, zc), (T3.BACK, H), (db, H)]      # the header: the lean's top, then upright
        cols = s.cols(pf, "face")                                       # down to its foot
        cols[1] = HEAD_FRONT
        f.part(h0, w1, pf, cols, None, end=False)
        prism(GLASS, ax, plane, w0, w1, [(dp - PANE / 2, zj), (dp + PANE / 2, zj), (dp + PANE / 2, zh),   # the
                                         (dp - PANE / 2, zh)], "steel", 3, ["glassL"] * 4, "glassL")         # pane
        e = EDGE_OUT
        pf = [(dp - PANE / 2, zj + e), (dp + PANE / 2, zj + e), (dp + PANE / 2, zh - e), (dp - PANE / 2, zh - e)]
        f.part(w0 + (e if PART == "w1" else 0.0), w1, pf, [EDGE, False, EDGE, False],     # its edges (an end only
               (EDGE if PART == "w1" else False, EDGE if PART == "w3" else False), end=False)  # at the jamb)
