"""Interior windows (walls up): a straight partition (mask 10, along x) opened between its posts, a beam over the
opening and a glass pane in it. A window piece is the look's own straight piece cut open: its body between the sill
(the lip's top over the ramp) and the beam (under the header's shadow) taken out over the opening, the cut closed (the
post's section, the sill's top, the beam's underside), the pane in the wall's middle plane, and the pane's top edges
two blue lines along the beam's top. The ramp runs on under the opening as the sill.

wall3d.block calls HOOK(k, sp) on a piece's Relief before it builds; window() sets it while its piece builds.
PART: "l" (the post at the -x end, open on past +x), "m" (open across), "r" (the post at the +x end)."""
from mathutils import Vector

from . import wall3d as T
from . import walls as W
from .faction import base as FB
from .faction import tan as TAN
from .faction.parts import PZ

POST = 12 / 32          # an end post's length along the wall (ref: 12 px of front)
LINES = 3 / 32          # the pane's top edges on the beam: this apart, about the wall's middle
LINE_W = 1 / 32
LINE_COL = "fTG0"
SILL_COL = "fTG1"       # the sill's top and the beam's underside: the cap's black
PART = None
CLOSE = False           # (a preview of a piece on its own: its open end closed, the half arch's sections shown)
DIP = 12 * PZ           # the window's ramp: its crest this far under the wall's ramp (ref #2767 B layer: ~7 px of a
                        # ~16 px ramp; ours is 26 px) ...
DIP_RUN = 0.5           # ... reached this far along the wall from a post (a sloped crest), then level (the middle
                        # tiles level all across)
EDGE_OUT = 0.0          # (the cut top out to the ramps' slope, no further)
POST_IN = "fTS3"        # the post's inner side (into the opening): the face's tan, a step into the shade
SLOPE_TOP = "fTW2"      # the sill's top where it slopes down from a post, a step under the level part's
SEAM = "fTS4"           # the seam where the slope meets the level part (the cushions' joint brown)
SILL_TOP = "fTW1"       # the sill's top: the cushions' lit tan
FB.TOP_KEEP.update((LINE_COL, SILL_COL, SILL_TOP, SLOPE_TOP, SEAM))
GLASS = None            # the pane's Relief, built by the piece (the glass render kind's second list)


def _heights():
    """(sill top, beam underside): the ramp's top (no lip over the opening: the pane down to the ramp); under
    the header cushion's shadow bands."""
    zs = W.skirt_top()
    z1 = W.HF - 0.031                                   # (tan: the header's top under the cap's black)
    zs0 = z1 - TAN.HEAD_H - TAN._hid(TAN.HEAD_D)
    return zs, zs0 - 3 * PZ


def _sill(x, x0, x1):
    """The ramp's crest under the opening at x: the wall's ramp top at a post, down DIP over DIP_RUN from it."""
    zs = W.skirt_top()
    d = min(([x - x0] if x0 > -0.5 else []) + ([x1 - x] if x1 < 0.5 else []) + [9.0])
    return zs - DIP * min(1.0, max(0.0, d) / DIP_RUN)


def _span(part):
    return {"l": (-0.5 + POST, 1.5), "m": (-1.5, 1.5), "r": (-1.5, 0.5 - POST)}[part]


def _side(pl, p):
    if len(pl) == 3:                                    # (i, v, s): s * (p[i] - v)
        return pl[2] * (p[pl[0]] - pl[1])
    n, c = pl                                           # (n, c): n . p - c
    return n[0] * p[0] + n[1] * p[1] + n[2] * p[2] - c


def _clip(pts, planes):
    """Sutherland-Hodgman: pts (tuples) kept where each plane's side (_side) >= 0."""
    for pl in planes:
        out = []
        for p, q in zip(pts, pts[1:] + pts[:1]):
            fp, fq = _side(pl, p), _side(pl, q)
            if fp >= -1e-9:
                out.append(p)
            if (fp >= -1e-9) != (fq >= -1e-9) and abs(fq - fp) > 1e-12:
                t = fp / (fp - fq)
                out.append(tuple(a + (b - a) * t for a, b in zip(p, q)))
        pts = out
        if len(pts) < 3:
            return []
    return pts


def _slabs(x0, x1):
    """The opening along x as slabs between the crest's bends: (u0, u1, h0, h1), past the tile where it runs on."""
    xa, xb = (x0 if x0 > -0.5 else -2.0), (x1 if x1 < 0.5 else 2.0)
    us = sorted({xa, xb} | {u for u in (x0 + DIP_RUN, x1 - DIP_RUN) if xa < u < xb})
    return [(u0, u1, _sill(u0, x0, x1), _sill(u1, x0, x1)) for u0, u1 in zip(us, us[1:])]


def _cut(k, x0, x1, z1):
    """Take everything over the window's crest and under the beam (z1) out over the opening, wall and ramps alike
    (what is left of a polygon, in convex pieces): the ramps cut level with the crest along it."""
    sl = _slabs(x0, x1)
    xa, xb, hmin = sl[0][0], sl[-1][1], min(min(h0, h1) for _, _, h0, h1 in sl)
    regions = [[(0, xa, -1)], [(0, xb, 1)]]
    for u0, u1, h0, h1 in sl:
        g = (h1 - h0) / (u1 - u0)
        inx = [(0, u0, 1), (0, u1, -1)]
        regions += [inx + [(2, z1, 1)], inx + [((g, 0.0, -1.0), g * u0 - h0)]]
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


def _reach(h, yf):
    """How far out of the wall's middle the ramps' slope is at height h (the cut top's half width)."""
    sl = W.GN * W.RAMP_PX / W.ZART                     # (the ramps' slope: z per unit out)
    return yf + (W.skirt_top() - h) / sl


def _quad(k, pts, out, col):
    k.poly([Vector(p) for p in pts], "wall", 2, Vector(out), fixed=col)


def hook(k, sp):
    x0, x1 = _span(PART)
    z0, z1 = _heights()
    yb, yf = W.wall_back() - 0.5, W.wall_back() - 0.5 + W.TW
    _cut(k, x0, x1, z1)
    a, b = max(x0, -0.5), min(x1, 0.5)
    bends = [u for u in (x0 + DIP_RUN, x1 - DIP_RUN) if a < u < b]
    k.side = None
    if x0 > -0.5:                                       # the posts' sections
        _quad(k, [(x0, yb, z0), (x0, yf, z0), (x0, yf, z1), (x0, yb, z1)], (1, 0, 0), POST_IN)
    if x1 < 0.5:
        _quad(k, [(x1, yb, z0), (x1, yf, z0), (x1, yf, z1), (x1, yb, z1)], (-1, 0, 0), POST_IN)
    us = [a] + bends + [b]                              # the sill's top (the cut along the crest, out to the ramps'
    for u0, u1 in zip(us, us[1:]):                      # slopes: wider as it drops) and the beam's underside
        h0, h1 = _sill(u0, x0, x1), _sill(u1, x0, x1)
        r0, r1 = _reach(h0, yf) + EDGE_OUT, _reach(h1, yf) + EDGE_OUT
        _quad(k, [(u0, -r0, h0), (u1, -r1, h1), (u1, r1, h1), (u0, r0, h0)], (0, 0, 1),
              SILL_TOP if abs(h1 - h0) < 1e-9 else SLOPE_TOP)
    for u in bends:                                     # (a seam a px wide where a slope meets the level part)
        h, r = _sill(u, x0, x1) + 0.002, _reach(_sill(u, x0, x1), yf)
        w = LINE_W if _sill(u + 1e-3, x0, x1) < _sill(u - 1e-3, x0, x1) else -LINE_W    # (on the level side)
        _quad(k, [(u, -r, h), (u + w, -r, h), (u + w, r, h), (u, r, h)], (0, 0, 1), SEAM)
    _quad(k, [(a, yb, z1), (b, yb, z1), (b, yf, z1), (a, yf, z1)], (0, 0, -1), SILL_COL)
    if CLOSE and x1 > 0.5:
        _close(k, yf, _sill(0.5, x0, x1), z1)
    zt = max(v[2] for v in k.m.v) + 0.002                # the pane's top edges on the beam's top
    for c in (-LINES / 2, LINES / 2):
        y0, y1 = -c - LINE_W / 2, -c + LINE_W / 2       # (grid y; G flips it, symmetric anyway)
        _quad(k, [(a, y0, zt), (b, y0, zt), (b, y1, zt), (a, y1, zt)], (0, 0, 1), LINE_COL)
    global GLASS
    GLASS = T.Relief("iwin_glass")                      # (the pane down to the crest)
    GLASS.poly([Vector((u, 0.0, _sill(u, x0, x1))) for u in us] + [Vector((b, 0.0, z1)), Vector((a, 0.0, z1))],
               "wall", 2, Vector((0, 1, 0)), fixed="glassL")


def _close(k, yf, h, z1):
    """The piece's +x end as a free end's, in the free ends' slate: the foot and the ramps' section cut level at the
    window's crest h, and the beam's over the opening (with the header cushion's, proud of the face)."""
    col, edge = TAN.END["x"], TAN.END_EDGE["x"]
    run, ft, top = W.skirt_run(), W.FOOT_PX / W.ZART, W.HF
    sl = W.GN * W.RAMP_PX / W.ZART
    dl = min(run, (W.skirt_top() - ft) / sl)
    re, yt, yl = _reach(h, yf), yf + run, yf + dl
    sec = [(-yt, 0.0035), (yt, 0.0035), (yt, ft), (yl, ft), (re, h), (-re, h), (-yl, ft), (-yt, ft)]
    k.poly([T.P("x", 0.5, u, z, 0.0) for u, z in sec], "wall", 2, T.OUT("x"), fixed=col)
    k.poly([T.P("x", 0.5, u, z, TAN.PAINT) for u, z in ((-yt, 0.0035), (yt, 0.0035), (yt, ft), (-yt, ft))],
           "wall", 2, T.OUT("x"), fixed=T.style().toe or col)
    zh1 = top - 0.031
    zh0 = zh1 - TAN.HEAD_H
    for y0, y1, za, zb in ((-yf, yf, z1, top), (yf, yf + TAN.HEAD_D, zh0, zh1)):
        _quad(k, [(0.5, y0, za), (0.5, y1, za), (0.5, y1, zb), (0.5, y0, zb)], (1, 0, 0), col)
    _quad(k, [(0.5 + 0.004, yf + TAN.HEAD_D - 1 / 32, zh0), (0.5 + 0.004, yf + TAN.HEAD_D, zh0),
              (0.5 + 0.004, yf + TAN.HEAD_D, zh1), (0.5 + 0.004, yf + TAN.HEAD_D - 1 / 32, zh1)], (1, 0, 0), edge)


def window(fn, part):
    """fn: the look's straight piece builder (tile.wall.<look>.full.m10). (solid objects, pane objects)."""
    def build():
        global PART
        PART = part
        T.HOOK = hook
        try:
            r = fn()
            solid = r[0] if isinstance(r, tuple) else r
            glass = GLASS.build()
            import bpy                                  # (a wide piece's copies past the tile: not in this render)
            for o in list(bpy.context.scene.objects):
                if o not in solid and o not in glass and o.type == "MESH":
                    bpy.data.objects.remove(o)
            return solid, glass
        finally:
            PART, T.HOOK = None, None
    return build
