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

DIP = 10 * PZ           # the sill: the ramp's crest under the opening, this far under the ramp's top (as tan's) ...
DIP_RUN = 13 / 32       # ... reached this far along the wall from a post (a sloped crest), then level
LINES = 3 / 32          # the pane's top edges on the cap: this apart, about the wall's middle
LINE_W = 1 / 32
LINE_COL = "fTG0"       # (blue)
POST_IN = "wD"          # the posts' sides into the opening (dark)
SILL_TOP = "wH"         # the sill's level top (the light)
SLOPE_TOP = "wS"        # the sill's top where it slopes down from a post (a step under)
REACH = 6 / 32          # the cut's near side: this far out of the wall's face (a quarter into the ramp's slope),
                        # the sill's top tilted down from the lip's front to meet the ramp's surface there
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
    """The crest's ends: at a post the lip's top, under the opening DIP under the ramp's top. (top, bottom)."""
    return T.lip_heights(W.skirt_top())[1], W.skirt_top() - DIP


def _sill(x, x0, x1):
    """The ramp's crest under the opening at x: the lip's top at a post, down to its floor over DIP_RUN from it."""
    d = min(([x - x0] if x0 > -0.5 else []) + ([x1 - x] if x1 < 0.5 else []) + [9.0])
    t, f = _dip()
    return t - (t - f) * min(1.0, max(0.0, d) / DIP_RUN)


def _segs(x0, x1):
    """The opening along x between the crest's bends: (u0, u1, h0, h1), past the tile where it runs on."""
    xa, xb = (x0 if x0 > -0.5 else -2.0), (x1 if x1 < 0.5 else 2.0)
    us = sorted({xa, xb} | {u for u in (x0 + DIP_RUN, x1 - DIP_RUN) if xa < u < xb})
    return [(u0, u1, _sill(u0, x0, x1), _sill(u1, x0, x1)) for u0, u1 in zip(us, us[1:])]


def _k():
    return W.GN * W.RAMP_PX / W.ZART


def _ys(yf):
    """The cut across the wall: (far edge, lip line, near edge, the ramp's height at the near edge). The sill's top
    level from the far edge (where the far ramp falls under the level sill) to the lip line (the near lip's front,
    its seams' paint), then tilted down to the near edge."""
    zs = W.skirt_top()
    return -(yf + DIP / _k()), yf + _lip_d() + 3 * T.PAINT, yf + REACH, zs - REACH * _k()


def _tilt(u0, u1, h0, h1, yl, yq, zq):
    """The sill's tilted strip over a segment: two triangles (a twisted quad where the crest slopes)."""
    A, B, C, D = (u0, yl, h0), (u1, yl, h1), (u1, yq, zq), (u0, yq, zq)
    return [(A, B, C), (A, C, D)]


def _under(tri):
    """Clip planes for the prism over a triangle in plan, under its plane."""
    A, B, C = (Vector(p) for p in tri)
    n = (B - A).cross(C - A)
    if n.z < 0:
        n = -n
    out = [((-n.x, -n.y, -n.z), -n.dot(A))]
    for P, Q, R in ((A, B, C), (B, C, A), (C, A, B)):
        m = (Q - P).cross(Vector((0, 0, 1)))
        if m.dot(R - P) < 0:
            m = -m
        out.append(((m.x, m.y, m.z), m.dot(P)))
    return out


def _lip_d():
    from .faction.slate import LIP_D
    return LIP_D


def _cut(k, x0, x1, z1, ys):
    """Take everything over the sill's top and under the beam (z1) out over the opening, from the far edge to the
    near one (ys: _ys): straight sides, the near ramp's slope past it left whole."""
    yF, yl, yq, zq = ys
    sg = _segs(x0, x1)
    xa, xb, hmin = sg[0][0], sg[-1][1], min(zq, min(min(h0, h1) for _, _, h0, h1 in sg))
    inx = [(0, xa, 1), (0, xb, -1)]
    regions = [[(0, xa, -1)], [(0, xb, 1)], inx + [(1, yq, 1)], inx + [(1, yF, -1)],
               inx + [(1, yF, 1), (1, yq, -1), (2, z1, 1)]]
    for u0, u1, h0, h1 in sg:
        g = (h1 - h0) / (u1 - u0)
        regions.append([(0, u0, 1), (0, u1, -1), (1, yF, 1), (1, yl, -1), ((g, 0.0, -1.0), g * u0 - h0)])
        regions += [_under(t) for t in _tilt(u0, u1, h0, h1, yl, yq, zq)]
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
    zs, z1 = W.skirt_top(), T.rail_foot(W.HF)           # (the beam's underside: the rail's foot)
    zp = _dip()[0]                                      # (the crest at a post: the lip's top)
    yf = W.wall_back() - 0.5 + W.TW
    yr = yf + T.FR                                      # (the face's relief: the posts', the band's, the header's)
    ys = yF, yl, yq, zq = _ys(yf)
    k.side = None
    _cut(k, x0, x1, z1, ys)
    a, b = max(x0, -0.5), min(x1, 0.5)
    for u, sd, on in ((x0, 1, x0 > -0.5), (x1, -1, x1 < 0.5)):     # the posts' sides into the opening
        if on:
            _quad(k, [(u, -yr, zp), (u, yr, zp), (u, yr, z1), (u, -yr, z1)], (sd, 0, 0), POST_IN)
    tilt = T.tone("wall", 3, Vector((0.0, _dip()[1] - zq, yq - yl)).normalized())
    for u0, u1, h0, h1 in _segs(x0, x1):                # the sill's top: level along the crest to the lip line,
        u0, u1 = max(u0, a), min(u1, b)                 # then tilted down to the ramp's surface
        if u1 <= u0:
            continue
        h0, h1 = _sill(u0, x0, x1), _sill(u1, x0, x1)
        _quad(k, [(u0, yF, h0), (u1, yF, h1), (u1, yl, h1), (u0, yl, h0)], (0, 0, 1),
              SILL_TOP if abs(h1 - h0) < 1e-9 else SLOPE_TOP)
        for t in _tilt(u0, u1, h0, h1, yl, yq, zq):    # (one tone, the level stretch's: the triangles' normals lean)
            k.poly([Vector(p) for p in t], "wall", 3, Vector((0, 1, 1)), fixed=tilt)
    dl, sh, zh = yl - yf, T.style().shelf, T.lip_heights(zs)[0]
    zm = zp + (zq - zp) * (sh - dl) / (REACH - dl)      # (at a post the tilt stands over the shelf: its end closed)
    for u, sd, on in ((x0, -1, x0 > -0.5), (x1, 1, x1 < 0.5)):
        if on and zm > zh:
            for tri in (((dl, zp), (REACH, zq), (sh, zh)), ((dl, zp), (sh, zh), (dl, zh))):
                k.poly([Vector((u, yf + d, z)) for d, z in tri], "wall", 2, Vector((sd, 0, 0)))
    _quad(k, [(a, -yr, z1), (b, -yr, z1), (b, yr, z1), (a, yr, z1)], (0, 0, -1), BEAM_UNDER)   # the beam's underside
    zt = max(v[2] for v in k.m.v) + 0.002               # the pane's top edges on the cap
    for c in (-LINES / 2, LINES / 2):
        y0, y1 = -c - LINE_W / 2, -c + LINE_W / 2
        _quad(k, [(a, y0, zt), (b, y0, zt), (b, y1, zt), (a, y1, zt)], (0, 0, 1), LINE_COL)
    if not own:                                         # (a copy past the tile: no pane)
        return
    h, e = PANE_T / 2, PANE_OUT                         # the pane's edges
    us = sorted({a, b} | {u for u in (x0 + DIP_RUN, x1 - DIP_RUN) if a < u < b})
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
    """fn: the default straight piece's builder (tile.wall.full.m10, env_build "wide"). (own, wide, pane objects)."""
    calls = [0]
    seq = (part, "m" if part in "lm" else None, "m" if part in "mr" else None)  # the piece; its copies one tile on
    #   at +x, at -x (envtiles._with_runs builds them in that order): the window running on into them, else plain

    pre = [0]

    def bare(sp):                                       # (a window tile's ramp built bare: its panel left out)
        T.BARE = bool(pre[0] < len(seq) and seq[pre[0]])
        pre[0] += 1

    def each(k, sp):
        global PART
        i = calls[0]
        calls[0] += 1
        if i < len(seq) and seq[i]:
            PART = seq[i]
            hook(k, sp, own=i == 0)

    def build():
        global PART
        calls[0] = pre[0] = 0
        T.HOOK, T.PRE_HOOK = each, bare
        try:
            own, wide = fn()
            assert calls[0] == 3, calls[0]
            return own, wide, GLASS.build()
        finally:
            PART, T.HOOK, T.PRE_HOOK, T.BARE = None, None, None, False
    return build
