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
from .wall3d_ext_geom import LEAN_RISE, LINE, YS, D, Face, Section

PART = None                         # the piece being built: "w1" | "w2" | "w3" (None: not a window)
HEAD = 21                           # the header: the lean's top this many px on screen (down its front)
GLASS_IN = 3 / 32                   # the glass this far behind the armour's own face
SILL = 25                           # the sill's front, px tall
SILL_RISE = 7.5                     # its top's slope: its rise from the front to the glass, px of height; cut off
                                    # level with the frame's front (behind it the top flat, to the glass)
SILL_FLAT = "hsXS"                  # that flat (shaded under the header; well under the slope's)
SILL_SLOPE = YS[5]                  # the slope (the header's lean's tone)
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
JAMB_SEAM = YS[3]                   # W1's jamb: a seam across its front (the base's front lines' tone)
RIB_PLATE = 3                       # W1's outer frame: a plate on its side, its top this many px under the jamb's
RIB_PLATE_TONE = YS[3]              # seam, down to the sill; REC proud, its face the base's plates' tone
MID_PLATE = (3, 0, 5)               # W2's sill: a plate on its slope, these px in from the tile's sides, from this
MID_PLATE_RISE = 1                  # many px down it on screen (from its top) this many px on down it; this many
MID_PLATE_SIDE = YS[1]              # px proud, its sides in this tone
FRONT_PLATES = (5, 3, 5, 3)         # W2's sill front: two plates, from these px either side of the tile's centre,
                                    # this many px wide, from its top this many px down, wrapping over onto the
                                    # slope this many px up it on screen; REC proud (on the slope MID_PLATE_RISE)
B_SIDES = (9, 19)                   # W1's header: B, a panel outlined across its top (B_BACK px out from the
B_BACK = 1                          # block's face, TOP_PX deep) and down both sides (px from the tile's edge) to
C_SIDE = 22                         # its foot; C, a strip on from B's right side to C_SIDE, from the base's upper
                                    # lean line down (measured off the reference; the base's two lines across its
                                    # lean run on up to B and on from C)
PLATE_FOOT = 2                      # B and C end on a line this many px down the header's upright face
E_RIBS = (11, 15)                   # W1's sill: E, a recess in its slope under B (its sides B's), from the slope's
E_RIB = 2                           # top edge to a px short of its front (a lip), REC deep, a step darker; two ribs
E_IN, E_SHORT = 1, 2                # standing in it at the slope's level, E_RIB px wide from these px from the
E_TONE = "hsL"                      # tile's edge, from E_IN px out from its back to E_SHORT px short of its front
F_ON = False                        # (F off for now)
F_U, F_RECESS = (8, 24), (11, 18)   # W1's sill front: F, a plate over these px from the tile's edge (centred) in
F_GRILLE = (6, 8)                   # the base's plates' tone, from the seam's top down: painted over a recess REC
F_SEAM, F_SEAM_DOWN = 26, (4, 18)   # deep (px down from the front's top; its ledge F_LEDGE), painted lines over that
F_FLOOR, F_LEDGE = YS[3], YS[1]     # (px down, F_LINE); a seam beside it, a dark px and a shade, over its height
F_LINE = "hsXS"
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
    back = min((r[0][2] if ax == "y" else r[0][0]) for r in T.SHELL.rects if r[1] == "hull") - plane   # (the
                                                        # tile's back: the header's top runs back to it, the base's)
    for s0, s1 in T.spans(a, b):
        end = PART in ("w1", "w3")                      # (an end piece: W3 W1 mirrored, built in W1's u then
        mu = (lambda u: s0 + s1 - u) if PART == "w3" else (lambda u: u)     # flipped by mu)

        def seg(u0, u1, cap=None):                      # a span in W1's u and its (start, end) caps, in the tile's
            if PART != "w3":
                return u0, u1, cap
            return mu(u1), mu(u0), cap[::-1] if isinstance(cap, tuple) else cap

        h0, w0, w1 = s0, s0, s1                         # (h0: the header's and the sill's start; w0: the glass's)
        if end:
            for z0, z1, d0 in ((0.0, zb, db), (zb, H, back)):     # the outer frame: the base section, whole
                pf = s.sec(z0, z1)                                  # (over the bend back as the header)
                cols = s.cols(pf, "face")
                pf = [(d0, pf[0][1])] + pf[1:-1] + [(d0, pf[-1][1])]
                u0, u1, cp = seg(s0, s0 + FRAME, (None, SIDE))
                f.part(u0, u1, pf, cols, cp, end=False)
            pf = [(db, 0.0), (dv, 0.0), (dv, zh), (db, zh)]     # the frame's side (jamb), under the header
            u0, u1, cp = seg(s0 + FRAME, s0 + FRAME + JAMB, (None, SIDE))
            f.part(u0, u1, pf, [None, HEAD_FRONT, None, None], cp, end=False)
            h0, w0 = s0 + FRAME, s0 + FRAME + JAMB
        u0, u1, _ = seg(h0, w1)
        pf = [(db, 0.0), (fr, 0.0), (fr, zs), (dv, zj), (db, zj)]       # the sill: its slope, then flat back
        cols = s.cols(pf, "face")
        cols[2], cols[3] = SILL_SLOPE, SILL_FLAT
        if PART == "w1":                                # (E's recess cut in its slope, F's in its front)
            _w1_sill(f, s0, u0, u1, db, fr, zs, dv, zj, cols[1])
        else:
            f.part(u0, u1, pf, cols, None, end=False)
        if PART == "w2":
            _w2_plate(f, s, s0, s1, fr, zs, dv, zj, cols[1])
        pf = [(back, zh), (dv, zh), (dv, zc), (T3.BACK, H), (back, H)]  # the header: the lean's top, then upright
        cols = s.cols(pf, "face")                                       # down to its foot; its top back to the
                                                                        # tile's back, as the base's
        cols[1] = HEAD_FRONT
        f.part(u0, u1, pf, cols, None, end=False)
        def sides(pts, col):                            # (none where the pane runs on into the next tile)
            return [False if abs(p[0] - q[0]) < 1e-6 and (abs(p[0] - w1) < 1e-2 or (not end and abs(p[0] - w0) < 1e-2))
                    else col for p, q in zip(pts, pts[1:] + pts[:1])]
        f.top_line(s0, s1, back + 2 * T3.TOP_PX, back + 2.75 * T3.TOP_PX, YS[2])   # A: the top's seam along its
                                                                                    # back, the base's own
        if PART == "w1":
            _w1_header(f, s, s0, s1, dv, zc, zh)
        win = _opening(w0, w1, zj, zh, end)
        _slab(GLASS, ax, plane, win, dp - PANE / 2, dp + PANE / 2, "glassL", [False] * len(win), back=False,
              mu=mu)                                    # the pane: its front only (one tinted layer: with its back,
                                                        # a px column more, which the next tile's pane covers too)
        pts = _inset(win, EDGE_OUT)                                     # its edges
        _slab(k, ax, plane, pts, dp - PANE / 2, dp + PANE / 2, False, sides(pts, EDGE), mu=mu)
        if end:                                                         # the slope and its foot (and the top's)
            fh, sh, ut = FOOT_H / core.ZPX, SLOPE_H / core.ZPX, w0 + SLOPE + FOOT_W
            _slab(k, ax, plane, [(w0, zj), (ut, zj), (ut, zj + fh), (w0 + SLOPE, zj + fh), (w0, zj + fh + sh)],
                  db, dv, HEAD_FRONT, [False, SIDE, SILL_FLAT, SLOPE_COL, False], back=False, mu=mu)
            _slab(k, ax, plane, [(w0, zh), (w0, zh - sh), (w0 + SLOPE, zh)], db, dv, HEAD_FRONT,   # the top corner's
                  [False, SLOPE_TOP, False], back=False, mu=mu)                                  # slope
            if PART == "w1":                            # a seam across the jamb's front where its foot's slope
                zl = zj + fh + sh                       # starts, from the outer frame round its side to the glass
                pf = [(dp + PANE / 2, zl), (dv + 0.001, zl), (dv + 0.001, zl + 1 / core.ZPX), (dp + PANE / 2,
                      zl + 1 / core.ZPX)]
                f.part(s0 + FRAME, w0 + 0.001, pf, [JAMB_SEAM] * 4, (None, JAMB_SEAM), end=False)
                zt = zl - RIB_PLATE / core.ZPX          # a plate on the outer frame's side, across it (from the
                pf = [(dv, zj)] + s.front(zs, zt) + [(dv, zt)]          # jamb's front to the frame's), its top
                                                        # RIB_PLATE px under that seam, down to the sill's slope
                cols = s.cols(pf, "face")
                f.part(s0 + FRAME, s0 + FRAME + T3.REC, pf, cols, (None, RIB_PLATE_TONE), end=False)


def _w2_plate(f, s, s0, s1, fr, zs, dv, zj, front):
    """W2's plates. One on its sill's slope: MID_PLATE[1] px down it on screen from its top, MID_PLATE[2] px on
    down it, MID_PLATE_RISE px proud (straight up), MID_PLATE[0] px in from the tile's sides, its sides (and foot)
    darker. Two on its front (FRONT_PLATES), over its top onto the slope."""
    k = (zs - zj) / (fr - dv)                           # (the slope's dz per unit out)
    dy = -k * core.ZPX + core.TILE_H / 2                # (px down on screen per unit out along it)
    d0 = dv + MID_PLATE[1] / dy
    d1 = min(fr, d0 + MID_PLATE[2] / dy)
    z0, z1, r = zj + k * (d0 - dv), zj + k * (d1 - dv), MID_PLATE_RISE / core.ZPX
    pf = [(d0, z0), (d1, z1), (d1, z1 + r), (d0, z0 + r)]
    cols = s.cols(pf, "face")
    cols[1], cols[2], cols[3] = MID_PLATE_SIDE, SILL_SLOPE, MID_PLATE_SIDE     # (its foot's and head's faces sides
                                                                            # too)
    f.part(s0 + T3.px(MID_PLATE[0]), s1 - T3.px(MID_PLATE[0]), pf, cols, MID_PLATE_SIDE, end=False)
    off, w, down, up = FRONT_PLATES                     # the front's two plates, wrapping over onto the slope
    R, zd = T3.REC, zs - down / core.ZPX
    d3 = fr - up / dy
    pf = [(fr, zd), (fr + R, zd), (fr + R, zs + k * R + r), (d3, zj + k * (d3 - dv) + r), (d3, zj + k * (d3 - dv)),
          (fr, zs)]
    cols = [False, front, SILL_SLOPE, False, False, False]
    c = (s0 + s1) / 2
    for u0, u1 in ((c - T3.px(off + w), c - T3.px(off)), (c + T3.px(off), c + T3.px(off + w))):
        f.part(u0, u1, pf, cols, MID_PLATE_SIDE, end=False)


def _w1_header(f, s, s0, s1, dv, zc, zh):
    """B and C on W1's header, and the base's lines across its lean run on to them (painted lines, as the base's:
    on its top in YS[2], down its front in YS[3])."""
    ln, H = LINE, s.H
    dk = (dv - T3.BACK) / (H - zc)                      # (the header's lean: out per unit down)

    def band(u0, u1, z0, z1, col):                      # a painted band on the header's front over [z0, z1]
        def d(z):
            return T3.BACK + (H - z) * dk if z > zc else dv
        cuts = [z1] + [z for z in (zc,) if z0 < z < z1] + [z0]
        for za, zb in zip(cuts, cuts[1:]):
            pf = [(d(za) - 0.01, za), (d(za) + 0.001, za), (d(zb) + 0.001, zb), (d(zb) - 0.01, zb)]
            f.part(u0, u1, pf, [col] * 4, col, end=False)

    b0, b1 = s0 + T3.px(B_SIDES[0]), s0 + T3.px(B_SIDES[1])
    dl = T3.px(B_BACK)
    f.top_line(b0, b1 + ln, dl, dl + T3.TOP_PX, YS[2])                  # B: across the top
    zl = zc - (PLATE_FOOT + 1) / core.ZPX                # (B and C's foot: on the upright face, a px tall)
    for u in (b0, b1):
        f.top_line(u, u + ln, dl + T3.TOP_PX, T3.BACK, YS[2])           # down its sides, over the top
        band(u, u + ln, zl, H, YS[3])                                   # and the front
    L = T3.Layout(s)
    zt = L.px(L.zr, -2)                                 # the base's lines across its lean (its own calls): the one
    c1 = s0 + T3.px(C_SIDE)                             # its top panel stands on (C's top), its seam
    for u0, u1 in ((s0, b0), (b1 + ln, s1)):
        f.line(u0, u1, zt, L.px(zt, -1), YS[4], bevel=False)
    for u0, u1 in ((s0, b0), (c1 + ln, s1)):
        f.line(u0, u1, L.px(L.l1, 1), L.l1, YS[3], wrap=False)
    band(c1, c1 + ln, zl, L.px(zt, -1), YS[3])                          # C: its side
    band(b0, c1 + ln, zl, zl + 1 / core.ZPX, YS[3])                     # their foot, across both


def _w1_sill(f, s0, u0, u1, db, fr, zs, dv, zj, front):
    """W1's sill over [u0, u1]: its body, its front a slab REC thick before it; E, its slope recessed over B's span
    (the slab its lip), two ribs standing in it; F on its front, a recess cut through the slab (the body's face its
    floor), painted lines over it, a seam beside it."""
    R, ln, Z = T3.REC, LINE, core.ZPX

    def z(d):                                           # the slope's top at d
        return zs + (fr - d) * (zj - zs) / (fr - dv)

    def paint(a, b, z0, z1, col, out=0.001):            # a painted band on the front
        f.part(a, b, [(fr - 0.01, z0), (fr + out, z0), (fr + out, z1), (fr - 0.01, z1)], [col] * 4, col, end=False)

    def px(n):
        return s0 + T3.px(n)

    df = fr - R                                         # the slab's back, the body's front
    e0, e1 = px(B_SIDES[0]), px(B_SIDES[1] + 1)
    body, bc = [(db, 0.0), (df, 0.0), (df, z(df)), (dv, zj), (db, zj)], [None, F_FLOOR, SILL_SLOPE, SILL_FLAT, None]
    f.part(u0, e0, body, bc, (None, SIDE), end=False)
    f.part(e1, u1, body, bc, None, end=False)
    dr, di = fr - T3.px(E_SHORT), dv + T3.px(E_IN)                      # E
    f.part(e0, e1, [(db, 0.0), (dv, 0.0), (dv, zj), (db, zj)], [False, YS[2], SILL_FLAT, None], None, end=False)
    f.part(e0, e1, [(dv, 0.0), (df, 0.0), (df, z(df) - R), (dv, zj - R)], [False, F_FLOOR, E_TONE, False], None,
           end=False)                                                   # its floor (its front F's, in F's recess)
    for n in E_RIBS:
        u = px(n)
        f.part(u, u + T3.px(E_RIB), [(di, z(di) - R), (dr, z(dr) - R), (dr, z(dr)), (di, z(di))],
               [False, YS[2], SILL_SLOPE, YS[2]], (False, SIDE), end=False)     # its ribs
    if not F_ON:                                                        # the slab whole
        f.part(u0, u1, [(df, 0.0), (fr, 0.0), (fr, zs), (df, z(df))], [False, front, SILL_SLOPE, False], None,
               end=False)
        return
    za, zb = zs - F_RECESS[1] / Z, zs - F_RECESS[0] / Z                 # F: the slab, cut through over its recess
    f0, f1 = px(F_U[0]), px(F_U[1])
    f.part(u0, u1, [(df, 0.0), (fr, 0.0), (fr, za), (df, za)], [False, front, F_LEDGE, False], None, end=False)
    for a, b, cp in ((u0, f0, (None, SIDE)), (f1, u1, None)):
        f.part(a, b, [(df, za), (fr, za), (fr, zb), (df, zb)], [False, front, False, False], cp, end=False)
    f.part(u0, u1, [(df, zb), (fr, zb), (fr, zs), (df, z(df))], [False, front, SILL_SLOPE, False], None, end=False)
    paint(px(F_U[0]), px(F_U[1]), zb, zs - F_SEAM_DOWN[0] / Z, F_FLOOR, 0.0005)     # the plate over the recess
    for n in F_GRILLE:
        paint(px(F_U[0]), px(F_U[1]), zs - (n + 1) / Z, zs - n / Z, F_LINE)
    zt, zu = zs - F_SEAM_DOWN[1] / Z, zs - F_SEAM_DOWN[0] / Z
    paint(px(F_SEAM), px(F_SEAM + 1), zt, zu, YS[1])
    paint(px(F_SEAM + 1), px(F_SEAM + 2), zt, zu, F_LINE)


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


def _slab(k, ax, plane, pts, d0, d1, face, edges, back=True, fam="steel", lvl=3, mu=None):
    """A (u, z) polygon (any simple one) through d0..d1: its front (and back) faces `face` (False: left out), its sides
    edges[i] (the one from pts[i] to pts[i + 1]; False: left out); mu: its u mapped (a mirrored piece)."""
    pts = [(mu(u), z) for u, z in pts] if mu else pts
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
