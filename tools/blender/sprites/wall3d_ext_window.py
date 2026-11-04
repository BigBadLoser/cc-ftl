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
rising 7.5 px over its depth; W1's outer frame 3 px, its jamb 9 px (ours
2 px and 5 px: narrower); the window's corner at the jamb's foot a cove of about 8 px."""
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
FRAME = 2 / 32                      # an end piece's outer frame (the whole base section), along the face
JAMB = 5 / 32                       # the window frame's side (W1: its left) inside it, along the face: upright from
                                    # the sill to the header, its front the header's
BEVEL = 5 / 32                      # the header: its lean only this far out from the top's front edge, then cut
                                    # upright (its front)
SIDE = "hsXL"                       # the sides facing the window (the outer frame's, the jamb's): one plane, one
                                    # tone, between the fronts'
HEAD_FRONT = YS[4]                  # the header's upright front (a step under the lean over it)
PANE = 1 / 32                       # the glass: a pane this thick, see-through and tinted (its own object: the
                                    # render's glass pass),
PANE_IN = 5 / 32                    # its front this far behind the frame's front (on whole px, so its edges
                                    # draw 1 px lines)
WALL_BACK = 5 / 32                  # the wall's back this far behind the pane's back (the window cut through to it)
EDGE = YS[0]                        # the pane's edges (all but its two faces): dark and opaque, a hair proud of
EDGE_OUT = 0.002                    # the frame they sit on, so each draws a dark line on it
COVE = 8 / 32                       # the window's corner at the jamb's foot: a cove this radius (the jamb's side
COVE_N = 8                          # curving into the sill's flat top, through the jamb's depth), in this many
                                    # facets: the upper ones the side's tone, the lower the flat's; the pane round
                                    # it
GLASS = None                        # the pane's builder while a piece is built (its caller renders it apart)


def build(k, ax, plane, a, b, ends, H):
    global GLASS
    s = Section(H, T3.BACK)
    f = Face(k, ax, plane, a, b, ends, s, T3.CORNER_C)
    zb, fr = s.zb, D + T3.BACK                          # (fr: the upright part's front, out from the block's face)
    zh = s.z_at(H, HEAD)                                # the header's foot
    zs = SILL / core.ZPX                                # the sill's front top
    gl = T3.BACK - GLASS_IN
    dv = T3.BACK + BEVEL                                # the header's upright front (and the jamb's)
    zj = zs + SILL_RISE / core.ZPX * (fr - dv) / (fr - gl)   # the sill's top level with it (the slope's top)
    zc = H - LEAN_RISE * BEVEL / D
    dp = dv - PANE_IN - PANE / 2                        # the pane's centre
    db = dp - PANE / 2 - WALL_BACK                      # the wall's back (the section reaches back to it)
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
        r = COVE if PART == "w1" else 0.0
        _slab(GLASS, ax, plane, _opening(w0, w1, zj, zh, r, 0.0), dp - PANE / 2, dp + PANE / 2, "glassL",
              ["glassL"] * 99)                                          # the pane
        e = EDGE_OUT                                                    # its edges (but where it runs on)
        pts = _opening(w0 + (e if r else 0.0), w1, zj + e, zh - e, r, e)
        _slab(k, ax, plane, pts, dp - PANE / 2, dp + PANE / 2, False,
              [False if abs(a[0] - b[0]) < 1e-9 and (abs(a[0] - w1) < 1e-9 or (not r and abs(a[0] - w0) < 1e-9))
               else EDGE for a, b in zip(pts, pts[1:] + pts[:1])])
        if r:                                                           # the cove
            arc = _arc(w0, zj, r, 0.0)
            cols = [SIDE if i < COVE_N / 2 else SILL_FLAT for i in range(COVE_N)]
            _slab(k, ax, plane, [(w0, zj)] + arc, db, dv, HEAD_FRONT, [False] + cols + [False], back=False)


def _arc(u0, z0, r, e):
    """The cove's arc (a corner at (u0, z0), radius r; e: its radius that much less), from the jamb down to the sill."""
    import math
    uc, zc = u0 + r, z0 + r
    return [(uc - (r - e) * math.cos(math.pi / 2 * i / COVE_N), zc - (r - e) * math.sin(math.pi / 2 * i / COVE_N))
            for i in range(COVE_N + 1)]


def _opening(u0, u1, z0, z1, r, e):
    """The window's opening in (u, z), anticlockwise from its top left: a cove of radius r at its bottom left."""
    if not r:
        return [(u0, z1), (u0, z0), (u1, z0), (u1, z1)]
    return [(u0, z1)] + _arc(u0 - e, z0 - e, r, e) + [(u1, z0), (u1, z1)]


def _slab(k, ax, plane, pts, d0, d1, face, edges, back=True, fam="steel", lvl=3):
    """A (u, z) polygon through d0..d1: its front (and back) faces `face` (False: left out), its sides edges[i] (the
    one from pts[i] to pts[i + 1]; False: left out)."""
    from mathutils import Vector
    from .faction.parts import ALONG
    o, up, al = T.OUT(ax), Vector((0, 0, 1)), ALONG(ax)
    uc, zc = sum(q[0] for q in pts) / len(pts), sum(q[1] for q in pts) / len(pts)
    if face is not False:
        k.poly([T.P(ax, plane, u, z, d1) for u, z in pts], fam, lvl, o, fixed=face)
        if back:
            k.poly([T.P(ax, plane, u, z, d0) for u, z in pts], fam, lvl, -o, fixed=face)
    for i, (a, b) in enumerate(zip(pts, pts[1:] + pts[:1])):
        if edges[i] is False:
            continue
        nu, nz = b[1] - a[1], a[0] - b[0]
        if nu * ((a[0] + b[0]) / 2 - uc) + nz * ((a[1] + b[1]) / 2 - zc) < 0:
            nu, nz = -nu, -nz
        k.poly([T.P(ax, plane, a[0], a[1], d0), T.P(ax, plane, b[0], b[1], d0), T.P(ax, plane, b[0], b[1], d1),
                T.P(ax, plane, a[0], a[1], d1)], fam, lvl, al * nu + up * nz, fixed=edges[i])
