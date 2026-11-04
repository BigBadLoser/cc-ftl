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
2 px and 5 px: narrower); the window's corner at the jamb's foot a slope onto a
small foot."""
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
SLOPE = 4 / 32                      # the window's corner at the jamb's foot: a slope this far along and
SLOPE_H = 5                         # this many px down (the jamb's side down to it, through the jamb's depth), ending
FOOT_H = 3                          # on a foot this many px tall, this far on from the slope's end; then down to the
FOOT_W = 5 / 32                     # sill's flat top (the slope measured off the reference's glass line)
SLOPE_COL = YS[2]                   # the slope (between the side's tone and the flat's)
SLOPE_TOP = "hsXS"                  # the top corner's slope (the same slope, under the header: facing down, darker)
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
        corner = PART == "w1"
        win = _opening(w0, w1, zj, zh, corner)
        _slab(GLASS, ax, plane, win, dp - PANE / 2, dp + PANE / 2, "glassL", ["glassL"] * len(win))   # the pane
        pts = _inset(win, EDGE_OUT)                                     # its edges (but where it runs on)
        _slab(k, ax, plane, pts, dp - PANE / 2, dp + PANE / 2, False,
              [False if abs(a[0] - b[0]) < 1e-6 and (abs(a[0] - w1) < 1e-2 or (not corner and abs(a[0] - w0) < 1e-2))
               else EDGE for a, b in zip(pts, pts[1:] + pts[:1])])
        if corner:                                                      # the slope and its foot (and the top's)
            fh, sh, ut = FOOT_H / core.ZPX, SLOPE_H / core.ZPX, w0 + SLOPE + FOOT_W
            _slab(k, ax, plane, [(w0, zj), (ut, zj), (ut, zj + fh), (w0 + SLOPE, zj + fh), (w0, zj + fh + sh)],
                  db, dv, HEAD_FRONT, [False, SIDE, SILL_FLAT, SLOPE_COL, False], back=False)
            _slab(k, ax, plane, [(w0, zh), (w0, zh - sh), (w0 + SLOPE, zh)], db, dv, HEAD_FRONT,   # the top corner's
                  [False, SLOPE_TOP, False], back=False)                                         # slope


def _opening(u0, u1, z0, z1, corner):
    """The window's opening in (u, z), anticlockwise from its top left (corner: the slope and its foot at its bottom
    left, the slope at its top left)."""
    if not corner:
        return [(u0, z1), (u0, z0), (u1, z0), (u1, z1)]
    fh, sh, ut = FOOT_H / core.ZPX, SLOPE_H / core.ZPX, u0 + SLOPE + FOOT_W
    return [(u0 + SLOPE, z1), (u0, z1 - sh), (u0, z0 + fh + sh), (u0 + SLOPE, z0 + fh), (ut, z0 + fh), (ut, z0),
            (u1, z0), (u1, z1)]


def _inset(pts, e):
    """An anticlockwise polygon's sides each moved e inward (its corners where they meet)."""
    n, out = len(pts), []
    for i in range(n):
        lines = []
        for a, b in ((pts[i - 1], pts[i]), (pts[i], pts[(i + 1) % n])):
            du, dz = b[0] - a[0], b[1] - a[1]
            ln = (du * du + dz * dz) ** 0.5
            nu, nz = -dz / ln, du / ln                  # (inward: left of the way round)
            lines.append(((a[0] + nu * e, a[1] + nz * e), (du, dz)))
        (p, d), (q, f) = lines
        den = d[0] * f[1] - d[1] * f[0]
        t = ((q[0] - p[0]) * f[1] - (q[1] - p[1]) * f[0]) / den
        out.append((p[0] + d[0] * t, p[1] + d[1] * t))
    return out


def _slab(k, ax, plane, pts, d0, d1, face, edges, back=True, fam="steel", lvl=3):
    """A (u, z) polygon (any simple one) through d0..d1: its front (and back) faces `face` (False: left out), its sides
    edges[i] (the one from pts[i] to pts[i + 1]; False: left out)."""
    from mathutils import Vector
    from .faction.parts import ALONG
    o, up, al = T.OUT(ax), Vector((0, 0, 1)), ALONG(ax)
    ccw = sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(pts, pts[1:] + pts[:1])) > 0
    if face is not False:
        k.poly([T.P(ax, plane, u, z, d1) for u, z in pts], fam, lvl, o, fixed=face)
        if back:
            k.poly([T.P(ax, plane, u, z, d0) for u, z in pts], fam, lvl, -o, fixed=face)
    for i, (a, b) in enumerate(zip(pts, pts[1:] + pts[:1])):
        if edges[i] is False:
            continue
        nu, nz = (b[1] - a[1], a[0] - b[0]) if ccw else (a[1] - b[1], b[0] - a[0])     # (outward)
        k.poly([T.P(ax, plane, a[0], a[1], d0), T.P(ax, plane, b[0], b[1], d0), T.P(ax, plane, b[0], b[1], d1),
                T.P(ax, plane, a[0], a[1], d1)], fam, lvl, al * nu + up * nz, fixed=edges[i])
