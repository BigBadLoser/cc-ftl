"""Interior windows on slate (walls up; Space Haven wall style 44, windows #2757 / #115 / #2861): the default walls'
window (wall3d_iwin_def: the opening, sill, beam, pane) and on its ramp the ref's lower layer: under the opening the
ramp's front grey (its blue plate only under the posts), recessed pockets in it (one on an end tile, two on a middle
one), their floors lit. A first blockout; the default window takes this ramp over once it is right.

PART: "l" (the post at the -x end), "m" (open across), "r" (the post at the +x end), as wall3d_iwin_def."""
from mathutils import Vector

from . import core
from . import wall3d as T
from . import walls as W
from . import wall3d_iwin_def as D
from .faction.parts import PZ
from .wall3d_iwin import _clip

L = 1 / 32                              # an art px along the wall
POCKETS = {"l": ((15, 27),), "m": ((3, 14), (17, 28)), "r": ((4, 16),)}   # px from the tile's start: each pocket
POCKET_TOP = 3                          # its top this many px under the sill's level top
POCKET_FOOT = 1                         # its floor this many px over the ramp's foot (so it runs RAISE px deeper)
POCKET_IN = 6 / 32                      # how far it runs back into the ramp, from the slope at its top
FLOOR_RISE = 2                          # px its floor climbs from the ramp's front to its back
FLOOR_LIT = {"l": "fGS0", "m": "fGT0", "r": "fGS0"}   # its floor: lit grey on an end tile, lit blue in the middle
BACK = "fGT6"                           # its back (dark navy)
SIDE = "fGS4"                           # its sides
GREY = "fGS2"                           # the ramp's front under the opening, in place of the blue plate (fallback)
RAISE = 3                               # px the window's floor (the sill's level top) stands over the default's


def _k():
    return W.GN * W.RAMP_PX / W.ZART


def _slope_y(z, yf):
    """The near ramp's slope: how far out (grid y) it is at height z."""
    return yf + W.skirt_run() - (z - W.foot()) / _k()


def _split_x(m, xs):
    """Split every polygon of mesh m at the planes x = xs (mesh space: x as grid x)."""
    for x in xs:
        out = []
        for f in m.f:
            pts = [m.v[i] for i in f[0]]
            lo, hi = min(p[0] for p in pts), max(p[0] for p in pts)
            if not (lo < x - 1e-9 and hi > x + 1e-9):
                out.append(f)
                continue
            for pl in ((0, x, -1), (0, x, 1)):
                q = _clip(pts, [pl])
                if len(q) < 3:
                    continue
                base = len(m.v)
                m.v += [tuple(p) for p in q]
                out.append((list(range(base, base + len(q))),) + tuple(f[1:]))
        m.f = out


def _carve(m, x0, x1, ya, yb, z0, z1):
    """Take the box x0..x1, ya..yb (mesh space y), z0..z1 out of mesh m (what is left of a polygon, in pieces)."""
    ix = [(0, x0, 1), (0, x1, -1)]
    iy = ix + [(1, ya, 1), (1, yb, -1)]
    regions = [[(0, x0, -1)], [(0, x1, 1)], ix + [(1, ya, -1)], ix + [(1, yb, 1)],
               iy + [(2, z0, -1)], iy + [(2, z1, 1)]]
    out = []
    for f in m.f:
        pts = [m.v[i] for i in f[0]]
        if (max(p[0] for p in pts) <= x0 + 1e-9 or min(p[0] for p in pts) >= x1 - 1e-9 or
                max(p[1] for p in pts) <= ya + 1e-9 or min(p[1] for p in pts) >= yb - 1e-9 or
                max(p[2] for p in pts) <= z0 + 1e-9 or min(p[2] for p in pts) >= z1 - 1e-9):
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


def _quad(k, pts, out, col):
    k.poly([Vector(p) for p in pts], "wall", 2, Vector(out), fixed=col)


def detail(k, part):
    x0, x1 = D._span(part)
    a, b = max(x0, -0.5), min(x1, 0.5)
    yf = W.wall_back() - 0.5 + W.TW
    zf = D._dip()[1]                                    # (the sill's level top: its floor)
    m = k.m
    _split_x(m, [u for u in (a, b) if -0.5 < u < 0.5])
    blues = {tuple(round(c, 5) for c in core.lin(f"fGT{s}")) for s in "0123456sw"}
    grey = m._cols(GREY)                                # the ramp's front under the opening grey: its blue plate's
    for i, f in enumerate(m.f):                         # polygons there (near side: mesh y < 0) take the grey
        pts = [m.v[j] for j in f[0]]
        cx = sum(p[0] for p in pts) / len(pts)
        c = tuple(round(v, 5) for v in f[2])
        if (a < cx < b and max(p[1] for p in pts) < -yf + 1e-6 and c in blues and
                max(p[2] for p in pts) <= W.skirt_top() + 1e-6):     # (the ramp's only: not the header's rail)
            m.f[i] = (f[0],) + grey
    for p0, p1 in POCKETS[part]:                        # the pockets
        u0, u1 = -0.5 + p0 * L, -0.5 + (p1 + 1) * L
        z0, z1 = W.foot() + POCKET_FOOT * PZ, zf - POCKET_TOP * PZ
        yb = _slope_y(z1, yf) - POCKET_IN               # (its back, grid y)
        y0, y1 = _slope_y(z0, yf), _slope_y(z1, yf)
        _carve(m, u0, u1, -(y0 + 0.05), -yb, z0, z1)
        zb = z0 + FLOOR_RISE * PZ                       # (the floor's back edge: it slopes up into the ramp)
        _quad(k, [(u0, yb, zb), (u1, yb, zb), (u1, y0, z0), (u0, y0, z0)], (0, zb - z0, y0 - yb), FLOOR_LIT[part])
        _quad(k, [(u0, yb, zb), (u1, yb, zb), (u1, yb, z1), (u0, yb, z1)], (0, 1, 0), BACK)
        for u, sd in ((u0, 1), (u1, -1)):
            _quad(k, [(u, yb, zb), (u, y0, z0), (u, y1, z1), (u, yb, z1)], (sd, 0, 0), SIDE)
        _quad(k, [(u0, yb, z1), (u1, yb, z1), (u1, y1, z1), (u0, y1, z1)], (0, 0, -1), SIDE)


def window(fn, part):
    """fn: slate's straight piece builder (tile.wall.slate.full.m10). (own, wide, pane objects)."""
    calls = [0]
    seq = (part, "m" if part in "mr" else None)        # the piece; its copy one tile on at -x (envtiles._with_runs)
    pre = [0]

    def bare(sp):
        T.BARE = bool(pre[0] < len(seq) and seq[pre[0]])
        T.OPEN = D._span(seq[pre[0]]) if T.BARE else None
        pre[0] += 1

    def each(k, sp):
        i = calls[0]
        calls[0] += 1
        if i < len(seq) and seq[i]:
            D.PART = seq[i]
            D.hook(k, sp, own=i == 0)
            detail(k, seq[i])

    def build():
        calls[0] = pre[0] = 0
        T.HOOK, T.PRE_HOOK = each, bare
        floor = D.FLOOR
        D.FLOOR = floor - RAISE * PZ
        try:
            own, wide = fn()
            assert calls[0] == len(seq), calls[0]
            return own, wide, D.GLASS.build()
        finally:
            D.FLOOR = floor
            D.PART, T.HOOK, T.PRE_HOOK, T.BARE, T.OPEN = None, None, None, False, None
    return build
