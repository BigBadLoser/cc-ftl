"""Interior windows on the default walls (walls up; after Space Haven's family #3168, windows #3173-#3175): a
straight partition (mask 10, along x) opened between its posts. The opening runs from the low band's top (the sill)
to the header's foot (the beam), the posts at the window's ends kept, the ones between taken out with the panels; a
glass pane in the wall's middle plane, its top edges two blue lines along the cap.

The same hook as wall3d_iwin (tan): wall3d.block calls HOOK(k, sp) on a piece's Relief before it builds.
PART: "l" (the post at the -x end, open on past +x), "m" (open across), "r" (the post at the +x end)."""
from mathutils import Vector

from . import wall3d as T
from . import walls as W
from .faction.parts import PZ
from .wall3d_iwin import _clip

RUN = 5 / 32            # the sill's crest: from the lip's top at a post down to the ramp's top over this far along
                        # the wall (the lip cut down), then on into the ramp ...
FLOOR = 5 * PZ          # ... to this far under the ramp's top (the window's floor) ...
END = 11.5 / 32         # ... reached this far along the wall from the post, then level
BEAM_DROP = 0.0         # (the beam's underside this far under the rail's foot: a look's, its header's foot kept)
SILL_OFF = 0.0          # (the crest stays at the lip's top this far in from the post before it starts down: a look's)
LINES = 3 / 32          # the pane's top edges on the cap: this apart, about the wall's middle
LINE_W = 1 / 32
LINE_COL = "fTG0"       # (blue)
POST_IN = "wD"          # the posts' sides into the opening (dark)
SILL_TOP = "wL"         # the sill's level top (a step under the light: its lit edge reads)
LIP_SLOPE = "wS"        # the sill's top where it slopes down from a post: off the lip (a step under) ...
RAMP_SLOPE = "wS"       # ... and on into the ramp (the seam between them)
EDGE = "wH"             # the sill's front edge lit, on the ramp just past it (the ramp's own lit edge), EDGE_W out; by
LIP_EDGE = "wL"         # the slope off the lip on the lip's front, a px down, in the lip's own lit top's colour
EDGE_W = 0.5 / 32
EDGE_W_SLOPE = 0.4 / 32   # (by the slope into the ramp: a px on screen, as the lip's, PZ tall)
SEAM = "wM"             # a seam across the sill where the slope off the lip ends and the one into the ramp starts
BEAM_UNDER = "wK"       # the beam's underside (the black)
PANE_EDGE = "fTX6"      # the pane's edges: a pane PANE_T thick, opaque, a hair proud of the frame (PANE_OUT)
PANE_T = 1 / 32
PANE_OUT = 0.003
POST = 11.25 / 32       # the end posts: the opening this far in from the tile's edge (as tan's POST_L)
PART = None
GLASS = None            # the pane's Relief, built by the piece (the glass render kind's second list)


def _span(part):
    return {"l": (-0.5 + POST, 1.5), "m": (-1.5, 1.5), "r": (-1.5, 0.5 - POST)}[part]


def _quad(k, pts, out, col):
    k.poly([Vector(p) for p in pts], "wall", 2, Vector(out), fixed=col)


def _dip():
    """The crest's ends: at a post the lip's top, under the opening FLOOR under the ramp's top. (top, bottom)."""
    zh, zp = T.lip_heights(W.skirt_top())
    return zp, zh - FLOOR


def _sill(x, x0, x1):
    """The ramp's crest under the opening at x: the lip's top at a post, down to the ramp's top over RUN from it,
    on down to its floor at END."""
    d = max(0.0, min(([x - x0] if x0 > -0.5 else []) + ([x1 - x] if x1 < 0.5 else []) + [9.0]) - SILL_OFF)
    (t, f), zh = _dip(), T.lip_heights(W.skirt_top())[0]
    if d < RUN:
        return t - (t - zh) * d / RUN
    return zh - (zh - f) * min(1.0, (d - RUN) / (END - RUN))


def _bends():
    """The crest's bends, from a post: where it starts down, reaches the ramp's top, reaches its floor."""
    return tuple(c for c in (SILL_OFF, SILL_OFF + RUN, SILL_OFF + END) if c > 0)


def _segs(x0, x1):
    """The opening along x between the crest's bends (and where it passes the ramp's top, off the lip onto the
    ramp): (u0, u1, h0, h1), past the tile where it runs on."""
    xa, xb = (x0 if x0 > -0.5 else -2.0), (x1 if x1 < 0.5 else 2.0)
    us = sorted({xa, xb} | {u for c in _bends() for u in (x0 + c, x1 - c) if xa < u < xb})
    return [(u0, u1, _sill(u0, x0, x1), _sill(u1, x0, x1)) for u0, u1 in zip(us, us[1:])]


def _k():
    return W.GN * W.RAMP_PX / W.ZART


def _width(h, m):
    """How far out of the wall's face the wall stands over height h (the near side, +y here): the lip over the ramp's
    top, the ramp under it (the cut across the wall, out to where the ramp falls under the sill). m: a height in the
    same stretch (h may be on its end)."""
    zs = W.skirt_top()
    return _lip_d() if m > T.lip_heights(zs)[0] else (zs - h) / _k()


def _lip_d():
    from .faction.slate import LIP_D
    return LIP_D


def _cut(k, x0, x1, z1, yF, yb):
    """Take everything over the crest and under the beam (z1) out over the opening, across the wall (yF to yb)."""
    sg = _segs(x0, x1)
    xa, xb, hmin = sg[0][0], sg[-1][1], min(min(h0, h1) for _, _, h0, h1 in sg)
    inx = [(0, xa, 1), (0, xb, -1)]
    regions = [[(0, xa, -1)], [(0, xb, 1)], inx + [(1, yb, 1)], inx + [(1, yF, -1)],
               inx + [(1, yF, 1), (1, yb, -1), (2, z1, 1)]]
    for u0, u1, h0, h1 in sg:
        g = (h1 - h0) / (u1 - u0)
        regions.append([(0, u0, 1), (0, u1, -1), (1, yF, 1), (1, yb, -1), ((g, 0.0, -1.0), g * u0 - h0)])
    for m in (k.m, k.ns):
        if m is None:
            continue
        out = []
        for f in m.f:
            pts = [m.v[i] for i in f[0]]
            xs, zs = [p[0] for p in pts], [p[2] for p in pts]
            if max(xs) <= xa + 1e-9 or min(xs) >= xb - 1e-9 or max(zs) <= hmin + 1e-9 or min(zs) >= z1 - 1e-9:
                out.append(f)
                continue
            for r in regions:
                q = _clip(pts, r)
                if len(q) < 3:
                    continue
                n = Vector(q[1]) - Vector(q[0])
                if max((Vector(a) - Vector(q[0])).cross(n).length for a in q) < 1e-10:
                    continue
                base = len(m.v)
                m.v += [tuple(p) for p in q]
                out.append((list(range(base, base + len(q))),) + tuple(f[1:]))
        m.f = out


def hook(k, sp, own=True):
    x0, x1 = _span(PART)
    zs, z1 = W.skirt_top(), T.rail_foot(W.HF) - BEAM_DROP   # (the beam's underside: the rail's foot)
    zp = _dip()[0]                                      # (the crest at a post: the lip's top)
    yf = W.wall_back() - 0.5 + W.TW
    yr = yf + T.FR                                      # (the face's relief: the posts', the band's, the header's)
    k.side = None
    _cut(k, x0, x1, z1, -1.0, 1.0)
    a, b = max(x0, -0.5), min(x1, 0.5)
    for u, sd, on in ((x0, 1, x0 > -0.5), (x1, -1, x1 < 0.5)):     # the posts' sides into the opening
        if on:
            _quad(k, [(u, -yr, zp), (u, yr, zp), (u, yr, z1), (u, -yr, z1)], (sd, 0, 0), POST_IN)
    for u0, u1, h0, h1 in _segs(x0, x1):                # the sill's top: along the crest, across the wall as wide
        u0, u1 = max(u0, a), min(u1, b)                 # as it stood there (the lip, then the ramp)
        if u1 <= u0:
            continue
        h0, h1 = _sill(u0, x0, x1), _sill(u1, x0, x1)
        w0, w1 = (yf + _width(h, (h0 + h1) / 2) for h in (h0, h1))
        v0, v1 = (yf + (zs - h) / _k() for h in (h0, h1))              # (the far side, -y: its plain ramp)
        _quad(k, [(u0, -v0, h0), (u1, -v1, h1), (u1, w1, h1), (u0, w0, h0)], (0, 0, 1),
              SILL_TOP if abs(h1 - h0) < 1e-9 else LIP_SLOPE if (h0 + h1) / 2 > T.lip_heights(zs)[0] else RAMP_SLOPE)
        e = 2 * T.PAINT                                 # (its front edge lit, on the wall's side of it)
        if (h0 + h1) / 2 > T.lip_heights(zs)[0]:       # (the lip's front, under the edge)
            _quad(k, [(u0, w0 + e, h0), (u1, w1 + e, h1), (u1, w1 + e, h1 - PZ), (u0, w0 + e, h0 - PZ)], (0, 1, 0),
                  LIP_EDGE)
        else:                                           # (the ramp, on down from the edge)
            ew = EDGE_W if abs(h1 - h0) < 1e-9 else EDGE_W_SLOPE
            n, dz = Vector((0, _k(), 1)).normalized() * e, ew * _k()
            _quad(k, [(u0, w0 + n.y, h0 + n.z), (u1, w1 + n.y, h1 + n.z), (u1, w1 + ew + n.y, h1 - dz + n.z),
                      (u0, w0 + ew + n.y, h0 - dz + n.z)], (0, 1, 1), EDGE)
    for xs, sd in ((x0 + SILL_OFF + RUN, 1), (x1 - SILL_OFF - RUN, -1)):   # the seam where the slope into the
        #   ramp starts
        xe = xs + sd * T.LINE
        if not (a < min(xs, xe) and max(xs, xe) < b):
            continue
        hs, he = _sill(xs, x0, x1), _sill(xe, x0, x1)
        ds, de = (yf + (zs - h) / _k() for h in (hs, he))
        _quad(k, [(xs, -ds, hs + T.PAINT), (xe, -de, he + T.PAINT), (xe, de, he + T.PAINT), (xs, ds, hs + T.PAINT)],
              (0, 0, 1), SEAM)
    yu = yf if BEAM_DROP > 0 else yr                    # (under the header: out to its relief; dropped under it, to
    _quad(k, [(a, -yu, z1), (b, -yu, z1), (b, yu, z1), (a, yu, z1)], (0, 0, -1), BEAM_UNDER)   # the face) the beam's
    #   underside
    zt = max(v[2] for v in k.m.v) + 0.002               # the pane's top edges on the cap
    for c in (-LINES / 2, LINES / 2):
        y0, y1 = -c - LINE_W / 2, -c + LINE_W / 2
        _quad(k, [(a, y0, zt), (b, y0, zt), (b, y1, zt), (a, y1, zt)], (0, 0, 1), LINE_COL)
    if not own:                                         # (a copy past the tile: no pane)
        return
    h, e = PANE_T / 2, PANE_OUT                         # the pane's edges
    us = sorted({a, b} | {u for c in _bends() for u in (x0 + c, x1 - c) if a < u < b})
    for u0, u1 in zip(us, us[1:]):
        h0, h1 = _sill(u0, x0, x1) + e, _sill(u1, x0, x1) + e
        _quad(k, [(u0, -h, h0), (u1, -h, h1), (u1, h, h1), (u0, h, h0)], (0, 0, 1), PANE_EDGE)
    _quad(k, [(a, -h, z1 - e), (b, -h, z1 - e), (b, h, z1 - e), (a, h, z1 - e)], (0, 0, -1), PANE_EDGE)
    for u, sd, on in ((x0, 1, x0 > -0.5), (x1, -1, x1 < 0.5)):
        if on:
            v = u + sd * e
            _quad(k, [(v, -h, zp), (v, h, zp), (v, h, z1), (v, -h, z1)], (sd, 0, 0), PANE_EDGE)
    global GLASS
    GLASS = T.Relief("iwin_def_glass")
    GLASS.poly([Vector((u, 0.0, _sill(u, x0, x1))) for u in us] + [Vector((b, 0.0, z1)), Vector((a, 0.0, z1))],
               "wall", 2, Vector((0, 1, 0)), fixed="glassL")


def window(fn, part):
    """fn: the default straight piece's builder (tile.wall.full.m10, env_build "wide"). (own, wide, pane objects): this
    window with the ramp of wall3d_iwin_ramp in the default's colours."""
    from . import wall3d_iwin_ramp as R
    return R.window(fn, part, R.TEAL)
