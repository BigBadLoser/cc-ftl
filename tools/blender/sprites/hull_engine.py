"""An engine's thruster block on the hull from outside: an add-on drawn over the engine's hull row, which keeps its
plain base hull pieces (their sloped tops, belly and every join as they are). One sprite two tiles wide over the
row's two inner tiles, drawn at the front one, its px only where it is in front of the hull ("over"): a plain
armoured block standing a little out of the outline, from under the hull's top down to over the belly's bottom
(squared off as its top), 4-5 px of the hull showing at either end, a recessed round port in its front where the
engine's bell comes out, two armoured shoulders on its top, set back over the hull's, tying it to the hull.
Detail comes later, as its own pass.

Frame: d out from the tiles' middle line, r along the run from the port's axis (the edge between the two tiles),
z up. o 2: space at +x, the run along y (STRAIGHT)."""
import math

from . import core
from . import wall3d as T
from . import wall3d_ext as X
from . import wall3d_belly as B
from . import wall3d_ext_geom as GE
from . import walls as W_

H = 2.05                # the hull's top
AXIS = 1.0              # the port's axis height (the Kestrel's thrust axis, lowered 0.3)
DF = GE.E + 0.25        # the block's front, out from the tiles' middle (8 px proud of the outline)
W = 0.87                # its half width along the run (the hull showing 4-5 px at either end)
ZT, C = 1.98, 0.09      # its top (a little under the hull's) and its front edges' chamfer (top and bottom)
ZF = W_.ZG - B.ARMOUR - B.SLOPE[1] + (H - ZT)      # its foot: as far over the belly's bottom as its top is under
                                                # the hull's, squared off the same (the slopes meet it alike)
RS, RD = 0.8, 0.3       # the port: radius (the bell's 0.76 there), depth
SH = 0.14               # the shoulders' rise over the top
SHOULDERS = ((-0.62, -0.16), (0.16, 0.62))       # their spans along the run
N = 32                  # segments round the port
YS = GE.YS


def _frame(o):
    """pt(d, r, z) in Blender space, the tile drawn at (the front one) at the origin."""
    dx, dy = X.STRAIGHT[(5, 2) if o == 2 else (10, 1)]
    out = (1, 0) if o == 2 else (0, 1)

    def pt(d, r, z):
        s = r - 0.5                                     # (the axis half a tile back along the run)
        return core.G(out[0] * d + dx * s, out[1] * d + dy * s, z)
    return pt


def _tone(n):
    """A face's tone by its outward normal (d, r, z)."""
    d, r, z = n
    if z > 0.8:
        return GE.TOP
    if z > 0.2:
        return YS[5]                                    # (chamfers, the shoulders' slopes: lit)
    if abs(r) > abs(d):
        return YS[2]
    return YS[4] if d > 0 else YS[1]


class _Builder:
    def __init__(self, o, name):
        self.pt, self.m = _frame(o), core.Mesh(name)

    def face(self, pts, n, col=None):
        """A face over (d, r, z) points, wound to face out along n (d, r, z)."""
        P = [self.pt(*p) for p in pts]
        nn = (P[1] - P[0]).cross(P[2] - P[0])
        out = self.pt(*n) - self.pt(0.0, 0.0, 0.0)
        self.m.poly(P if nn.dot(out) > 0 else P[::-1], col or _tone(n))

    def prism(self, prof, r0, r1, skip=(), along="r", col=None):
        """A convex profile run from r0 to r1: its two ends and a face per edge (but those in skip). The profile is
        (d, z) run along r, or (r, z) run along d (`along` "d"); `col` its faces' tone (default by facing)."""
        at = (lambda x, a, z: (x, a, z)) if along == "r" else (lambda x, a, z: (a, x, z))
        cx, cz = sum(p[0] for p in prof) / len(prof), sum(p[1] for p in prof) / len(prof)
        self.face([at(x, r0, z) for x, z in prof], at(0, -1, 0), col)
        self.face([at(x, r1, z) for x, z in prof], at(0, 1, 0), col)
        for i, (a, b) in enumerate(zip(prof, prof[1:] + prof[:1])):
            if i in skip:
                continue
            nx, nz = b[1] - a[1], -(b[0] - a[0])        # (the edge's normal, turned out from the middle)
            if nx * ((a[0] + b[0]) / 2 - cx) + nz * ((a[1] + b[1]) / 2 - cz) < 0:
                nx, nz = -nx, -nz
            ln = math.hypot(nx, nz)
            self.face([at(a[0], r0, a[1]), at(b[0], r0, b[1]), at(b[0], r1, b[1]), at(a[0], r1, a[1])],
                      at(nx / ln, 0, nz / ln), col)


def _rect(c, s):
    """Where a ray from the port's axis at (c, s) leaves the front face's rectangle, as (r, z)."""
    t = min(W / abs(c) if abs(c) > 1e-9 else math.inf,
            (ZT - C - AXIS) / s if s > 1e-9 else (AXIS - ZF - C) / -s if s < -1e-9 else math.inf)
    return c * t, AXIS + s * t


def housing(o):
    """The block, one mesh."""
    b = _Builder(o, f"engine_housing_{o}")
    prof = [(0.0, ZF), (DF - C, ZF), (DF, ZF + C), (DF, ZT - C), (DF - C, ZT), (0.0, ZT)]
    b.prism(prof, -W, W, skip=(2,))                     # (its front: below, with the port)
    ts = {2 * math.pi * i / N for i in range(N)}
    for zc in (ZF + C, ZT - C):                             # (the front's corners, so its edges stay straight)
        for rc in (-W, W):
            ts.add(math.atan2(zc - AXIS, rc) % math.tau)
    ts = sorted(ts)
    for t0, t1 in zip(ts, ts[1:] + ts[:1]):
        c0, s0, c1, s1 = math.cos(t0), math.sin(t0), math.cos(t1), math.sin(t1)
        (r0, z0), (r1, z1) = _rect(c0, s0), _rect(c1, s1)
        p0, p1 = (RS * c0, AXIS + RS * s0), (RS * c1, AXIS + RS * s1)
        b.face([(DF, *p0), (DF, r0, z0), (DF, r1, z1), (DF, *p1)], (1, 0, 0))
        b.face([(DF, *p0), (DF - RD, *p0), (DF - RD, *p1), (DF, *p1)], (0, -(c0 + c1), -(s0 + s1)), YS[1])
    b.face([(DF - RD, RS * math.cos(t), AXIS + RS * math.sin(t)) for t in ts], (1, 0, 0), "hsXK")
    shoulder = [(-0.5, ZT - 0.05), (0.3, ZT - 0.05), (0.3, H + SH - 0.08), (0.22, H + SH),
                (-0.5, H + SH)]                 # (on the top, set back over the hull's: none down the front)
    for r0, r1 in SHOULDERS:
        b.prism(shoulder, r0, r1)
    return b.m.build()


def piece(o):
    """(own, wide) for an "over" sprite: the block, and the row's four tiles of base hull it sits on."""
    mask = 5 if o == 2 else 10
    dx, dy = X.STRAIGHT[(mask, o)]
    was, T.VARIANT = T.VARIANT, (0, 0)
    try:
        hull = []
        for k in (-2, -1, 0, 1):
            for ob in X.ext_block(mask, o):
                ob.location = ob.location + core.G(k * dx, k * dy, 0.0)
                hull.append(ob)
    finally:
        T.VARIANT = was
    own = [housing(o)]
    return own, own + hull
