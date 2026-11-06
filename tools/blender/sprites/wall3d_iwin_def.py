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
DIP_RUN = 8 / 32        # ... reached this far along the wall from a post (a sloped crest), then level
BEAM_DOWN = 0.15        # the beam's underside: the header's foot under the wall's top (wall3d.wall_face)
LINES = 3 / 32          # the pane's top edges on the cap: this apart, about the wall's middle
LINE_W = 1 / 32
LINE_COL = "fTG0"       # (blue)
POST_IN = "wD"          # the posts' sides into the opening (dark)
SILL_TOP = "wH"         # the sill's level top (the light)
SLOPE_TOP = "wS"        # the sill's top where it slopes down from a post (a step under)
BEAM_UNDER = "wK"       # the beam's underside (the black)
RAMP = "wM"             # the ramps on a window tile: plain, their art cleared
RAMP_FOOT = "wD"        # (their upright foot)
PANE_EDGE = "fTX6"      # the pane's edges: a pane PANE_T thick, opaque, a hair proud of the frame (PANE_OUT)
PANE_T = 1 / 32
PANE_OUT = 0.003
BEAM_OUT = T.PX         # the beam's blocks: this far proud of the header, split at the header's joints (a px gap)
PART = None
GLASS = None            # the pane's Relief, built by the piece (the glass render kind's second list)


def _span(part):
    return {"l": (-0.5 + T.STILE, 1.5), "m": (-1.5, 1.5), "r": (-1.5, 0.5 - T.STILE)}[part]


def _quad(k, pts, out, col):
    k.poly([Vector(p) for p in pts], "wall", 2, Vector(out), fixed=col)


def _sill(x, x0, x1):
    """The ramp's crest under the opening at x: the ramp's top at a post, down DIP over DIP_RUN from it."""
    d = min(([x - x0] if x0 > -0.5 else []) + ([x1 - x] if x1 < 0.5 else []) + [9.0])
    return W.skirt_top() - DIP * min(1.0, max(0.0, d) / DIP_RUN)


def _segs(x0, x1):
    """The opening along x between the crest's bends: (u0, u1, h0, h1), past the tile where it runs on."""
    xa, xb = (x0 if x0 > -0.5 else -2.0), (x1 if x1 < 0.5 else 2.0)
    us = sorted({xa, xb} | {u for u in (x0 + DIP_RUN, x1 - DIP_RUN) if xa < u < xb})
    return [(u0, u1, _sill(u0, x0, x1), _sill(u1, x0, x1)) for u0, u1 in zip(us, us[1:])]


def _reach(h, yf):
    """How far out of the wall's middle the ramps' slope is at height h."""
    return yf + (W.skirt_top() - h) / (W.GN * W.RAMP_PX / W.ZART)


def _cut(k, x0, x1, z1):
    """Take everything over the crest and under the beam (z1) out over the opening, wall and ramps alike."""
    sg = _segs(x0, x1)
    xa, xb, hmin = sg[0][0], sg[-1][1], min(min(h0, h1) for _, _, h0, h1 in sg)
    regions = [[(0, xa, -1)], [(0, xb, 1)], [(0, xa, 1), (0, xb, -1), (2, z1, 1)]]
    for u0, u1, h0, h1 in sg:
        g = (h1 - h0) / (u1 - u0)
        regions.append([(0, u0, 1), (0, u1, -1), ((g, 0.0, -1.0), g * u0 - h0)])
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
    zs, z1 = W.skirt_top(), W.HF - BEAM_DOWN
    yf = W.wall_back() - 0.5 + W.TW
    yr = yf + T.FR                                      # (the face's relief: the posts', the band's, the header's)
    k.side = None
    _plain(k, zs, yf)
    _cut(k, x0, x1, z1)
    a, b = max(x0, -0.5), min(x1, 0.5)
    for u, sd, on in ((x0, 1, x0 > -0.5), (x1, -1, x1 < 0.5)):     # the posts' sides into the opening
        if on:
            _quad(k, [(u, -yr, zs), (u, yr, zs), (u, yr, z1), (u, -yr, z1)], (sd, 0, 0), POST_IN)
    for u0, u1, h0, h1 in _segs(x0, x1):                # the sill's top: the cut along the crest, out to the ramps
        u0, u1 = max(u0, a), min(u1, b)
        if u1 <= u0:
            continue
        h0, h1 = _sill(u0, x0, x1), _sill(u1, x0, x1)
        r0, r1 = _reach(h0, yf), _reach(h1, yf)
        _quad(k, [(u0, -r0, h0), (u1, -r1, h1), (u1, r1, h1), (u0, r0, h0)], (0, 0, 1),
              SILL_TOP if abs(h1 - h0) < 1e-9 else SLOPE_TOP)
    _quad(k, [(a, -yr, z1), (b, -yr, z1), (b, yr, z1), (a, yr, z1)], (0, 0, -1), BEAM_UNDER)   # the beam's underside
    _beam(k, z1)
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
            _quad(k, [(v, -h, zs), (v, h, zs), (v, h, z1), (v, -h, z1)], (sd, 0, 0), PANE_EDGE)
    global GLASS
    GLASS = T.Relief("iwin_def_glass")
    GLASS.poly([Vector((u, 0.0, _sill(u, x0, x1))) for u in us] + [Vector((b, 0.0, z1)), Vector((a, 0.0, z1))],
               "wall", 2, Vector((0, 1, 0)), fixed="glassL")


def _plain(k, zs, yf):
    """Clear the ramps' art (their plates, the shell's slope under them) over the tile and lay them again plain: the
    slope from the wall's face down to the foot, the foot upright, both sides."""
    ft = W.FOOT_PX / W.ZART
    yt = yf + W.skirt_run()
    for m in (k.m, k.ns):
        if m is None:
            continue
        m.f = [f for f in m.f if not all(m.v[i][2] <= zs + 1e-6 and abs(m.v[i][1]) >= yf - 1e-6 for i in f[0])]
    sl = Vector((0.0, (zs - ft) / W.skirt_run(), 1.0)).normalized()
    for sd in (1, -1):
        _quad(k, [(-0.5, sd * yf, zs), (0.5, sd * yf, zs), (0.5, sd * yt, ft), (-0.5, sd * yt, ft)],
              (0, sd * sl.y, sl.z), RAMP)
        _quad(k, [(-0.5, sd * yt, ft), (0.5, sd * yt, ft), (0.5, sd * yt, 0.0), (-0.5, sd * yt, 0.0)], (0, sd, 0),
              RAMP_FOOT)


def _beam(k, z1):
    """The beam's blocks over the whole tile: the header (wall3d.wall_face) stood BEAM_OUT further out, split at its
    joints (header_marks: a long middle block, the end blocks across the tile's edges) by a px gap."""
    yf = W.wall_back() - 0.5 + W.TW
    zt = W.HF - 0.02
    cuts = [-0.5, -0.18, 0.18 - T.LINE, 0.5]
    for u0, u1 in zip(cuts, cuts[1:]):
        a = u0 + (T.LINE if u0 > -0.5 else 0.0)
        b = u1 - (0.0 if u1 >= 0.5 else 0.0)
        T.slab(k, "y", yf, a, b, z1, zt, T.FR + BEAM_OUT, "wall", 3, ends=(u0 > -0.5, u1 < 0.5))


def window(fn, part):
    """fn: the default straight piece's builder (tile.wall.full.m10, env_build "wide"). (own, wide, pane objects)."""
    calls = [0]
    seq = (part, "m" if part in "lm" else None, "m" if part in "mr" else None)  # the piece; its copies one tile on
    #   at +x, at -x (envtiles._with_runs builds them in that order): the window running on into them, else plain

    def each(k, sp):
        global PART
        i = calls[0]
        calls[0] += 1
        if i < len(seq) and seq[i]:
            PART = seq[i]
            hook(k, sp, own=i == 0)

    def build():
        global PART
        calls[0] = 0
        T.HOOK = each
        try:
            own, wide = fn()
            assert calls[0] == 3, calls[0]
            return own, wide, GLASS.build()
        finally:
            PART, T.HOOK = None, None
    return build
