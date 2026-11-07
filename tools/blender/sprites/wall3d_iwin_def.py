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
                        # the wall (the lip cut down), then on at that slope into the ramp ...
FLOOR = 7 * PZ          # ... to this far under the ramp's top (the window's floor), then level
LINES = 3 / 32          # the pane's top edges on the cap: this apart, about the wall's middle
LINE_W = 1 / 32
LINE_COL = "fTG0"       # (blue)
POST_IN = "wD"          # the posts' sides into the opening (dark)
SILL_TOP = "wH"         # the sill's level top (the light)
SLOPE_TOP = "wS"        # the sill's top where it slopes down from a post (a step under)
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


def _run():
    """How far along the wall from a post the crest reaches its floor (at the lip's slope: RUN per lip to ramp top)."""
    zh, zp = T.lip_heights(W.skirt_top())
    return RUN * (zp - _dip()[1]) / (zp - zh)


def _sill(x, x0, x1):
    """The ramp's crest under the opening at x: the lip's top at a post, down to its floor over _run() from it."""
    d = min(([x - x0] if x0 > -0.5 else []) + ([x1 - x] if x1 < 0.5 else []) + [9.0])
    t, f = _dip()
    return t - (t - f) * min(1.0, max(0.0, d) / _run())


def _segs(x0, x1):
    """The opening along x between the crest's bends (and where it passes the ramp's top, off the lip onto the
    ramp): (u0, u1, h0, h1), past the tile where it runs on."""
    xa, xb = (x0 if x0 > -0.5 else -2.0), (x1 if x1 < 0.5 else 2.0)
    (t, f), r = _dip(), _run()
    cs = [r * (t - z) / (t - f) for z in (T.lip_heights(W.skirt_top())[0],)]
    us = sorted({xa, xb} | {u for u in (x0 + r, x1 - r) + tuple(v for c in cs for v in (x0 + c, x1 - c))
                            if xa < u < xb})
    return [(u0, u1, _sill(u0, x0, x1), _sill(u1, x0, x1)) for u0, u1 in zip(us, us[1:])]


def _k():
    return W.GN * W.RAMP_PX / W.ZART


def _width(h, m):
    """How far out of the wall's face the wall stands over height h (either side): the lip over the ramp's top, the
    ramp under it (the cut across the wall, out to where the ramp falls under the sill). m: a height in the same
    stretch (h may be on its end)."""
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
    zs, z1 = W.skirt_top(), T.rail_foot(W.HF)           # (the beam's underside: the rail's foot)
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
        _quad(k, [(u0, -w0, h0), (u1, -w1, h1), (u1, w1, h1), (u0, w0, h0)], (0, 0, 1),
              SILL_TOP if abs(h1 - h0) < 1e-9 else SLOPE_TOP)
    _quad(k, [(a, -yr, z1), (b, -yr, z1), (b, yr, z1), (a, yr, z1)], (0, 0, -1), BEAM_UNDER)   # the beam's underside
    zt = max(v[2] for v in k.m.v) + 0.002               # the pane's top edges on the cap
    for c in (-LINES / 2, LINES / 2):
        y0, y1 = -c - LINE_W / 2, -c + LINE_W / 2
        _quad(k, [(a, y0, zt), (b, y0, zt), (b, y1, zt), (a, y1, zt)], (0, 0, 1), LINE_COL)
    if not own:                                         # (a copy past the tile: no pane)
        return
    h, e = PANE_T / 2, PANE_OUT                         # the pane's edges
    us = sorted({a, b} | {u for u in (x0 + _run(), x1 - _run()) if a < u < b})
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
