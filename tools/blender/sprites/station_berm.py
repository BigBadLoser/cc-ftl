"""MOCK (asteroid base, #524): the rock berm heaped against a ground base's station hull, after the user's station hull
reference (#1149: rubble along the hull's foot). One sprite per hull key, tile.hull.station.berm.<key name>, drawn over
the tile's hull piece.

A low ridge of the asteroid's levelled ground (rock_ground's tones), heaped over the hull's foot step and falling away
onto the ground about a third of a tile out, lumpy, with loose stones on it (as rockwall's skirt stones). Its height is a
function of the distance out from the ship's outline (the key's fronts), so runs, corners and diagonals meet: each tile
draws the ridge whose foot lies on its own stretch of outline (and the wedge round a convex corner). Rendered with the
tile's hull piece as a holdout, so where the hull stands in front of it the berm is hidden."""
import math

import numpy as np
from mathutils import Vector

from . import core
from . import hull_outline as HO
from .rock_base import TAU, Canvas, gbase, per2, polyg, rng, tri, quad

H0 = 7.0                            # px: the ridge's crest over the deck (the foot step's top is 4 px)
CREST = 0.07                        # tiles out from the outline: the crest (over the step, 3/32 + a block proud)
REACH = 0.42                        # tiles out from the outline: where it has fallen to the ground (a third of a tile
                                    # past the step), give or take WOBBLE
WOBBLE = 0.07
VARIANTS = 3                        # per key, picked per tile; each its own lumps, reach and stones (VAR_*), faded out at
VAR_REACH, VAR_H = 0.06, 1.5        # its stretch's ends so neighbours of any variant meet
N = 48                              # surface grid cells per tile
STONES = (2, 4)                     # loose stones per tile (and variant)
STONE = ("rk", "rkM", "rk", "rkM")
EPS = 0.3                           # px: a facet all under this over the ground is not drawn (the ground shows)


def _fronts(key):
    """The key's fronts facing the camera (+x or +y): (unit normal, offset) of the line n . p = c (ship side n.p <= c)."""
    out = []
    for st in HO.parse(key):
        for (sx, sy), c in st:
            n = Vector((sx, sy))
            L = n.length
            out.append((n / L, c / 32 / L, sx > 0 or sy > 0))
    return out


def _poly(fronts):
    """The tile's ship region (the square cut by every front), as [(point, label of the edge from it)]: label a front's
    index or None (a tile side)."""
    pts = [(Vector((-0.5, -0.5)), None), (Vector((0.5, -0.5)), None), (Vector((0.5, 0.5)), None),
           (Vector((-0.5, 0.5)), None)]
    for i, (n, c, _) in enumerate(fronts):
        res = []
        for j, (a, la) in enumerate(pts):
            b, _ = pts[(j + 1) % len(pts)]
            fa, fb = c - n.dot(a), c - n.dot(b)
            if fa >= -1e-9:
                res.append((a, la))
            if (fa >= -1e-9) != (fb >= -1e-9):
                p = a.lerp(b, fa / (fa - fb))
                res.append((p, i if fa >= -1e-9 else la))
        pts = res
        if len(pts) < 3:
            return []
    return pts


def _dist(poly, fronts, p):
    """(distance out from this tile's stretch of outline, the variant window there), or None where another tile's
    stretch owns p (or it is inside the ship, or behind a far front). The stretch: a visible front's edge (the window
    sin^2 along it: 0 at its ends, where the next tile's variant takes over), or the wedge round a convex corner between
    two (window 0)."""
    best = None
    m = len(poly)
    for j, (a, lab) in enumerate(poly):
        if lab is None:
            continue
        b = poly[(j + 1) % m][0]
        n, c, seen = fronts[lab]
        ab = b - a
        L2 = ab.length_squared
        t = (p - a).dot(ab) / L2 if L2 > 1e-12 else 0.0
        d = n.dot(p) - c
        if d <= 0:
            continue
        if -1e-9 <= t <= 1 + 1e-9:
            if not seen:
                return None
            w = math.sin(math.pi * max(0.0, min(1.0, t))) ** 2 * min(1.0, math.sqrt(L2) / 0.5)
            best = (d, w) if best is None or d < best[0] else best
    for j, (v, lab) in enumerate(poly):                 # convex corners: a vertex between two front edges
        prev = poly[j - 1][1]
        if lab is None or prev is None or lab == prev:
            continue
        n1, n2 = fronts[prev][0], fronts[lab][0]
        q = p - v
        if q.dot(n1) > 0 and q.dot(n2) > 0 and fronts[prev][2] and fronts[lab][2]:
            if best is None or q.length < best[0]:      # (in a strip the edge's own is nearer)
                best = (q.length, 0.0)
    return best


def _height(d, w, x, y, var):
    """The ridge over the ground at distance d out from the outline (tiles of height); w: the variant's share."""
    sv = 900 + 37 * var
    reach = REACH + WOBBLE * per2(x * 2, y * 2, 811, n=3) / 1.5 + w * VAR_REACH * per2(x * 3, y * 3, sv, n=3)
    h0 = (H0 + 1.2 * per2(x * 3, y * 3, 813, n=3) + w * VAR_H * per2(x * 2.5, y * 2.5, sv + 1, n=3)) / core.ZPX
    if d < CREST:
        f = 1.0 - 0.15 * (1 - d / CREST)                # (it leans on the wall: a touch lower at the foot)
    else:
        r = min(1.0, (d - CREST) / max(0.05, reach - CREST))
        f = (1 - r) ** 1.6 * (1 + 0.6 * r)
    lump = 0.12 * per2(x * 3, y * 3, 817, n=4) + w * 0.12 * per2(x * 3.5, y * 3.5, sv + 2, n=3)
    return max(0.0, h0 * f * (1 + lump * min(1.0, f * 3)))


def _col(n, x, y, frac):
    """Tone by height up the heap (frac: 0 at its toe, 1 at its crest), not by facing (the station hull lights both
    near faces alike): a light crest, the ground's own tone midway, a darker toe ring outlining it on the ground; a
    slope turned from the camera (toward the wall) the dark."""
    if n.x + n.y < -0.35:
        return "gdD"
    t = frac + 0.06 * per2(x * 4, y * 4, 823, n=3)
    return "gdL" if t > 0.62 else "gd" if t > 0.3 else "gdM" if t > 0.08 else "gdD"


def berm(key, var=0):
    """The berm's objects for a tile with this key in variant var (none if no visible front of it has any)."""
    fronts = _fronts(key)
    if not any(f[2] for f in fronts):
        return []
    poly = _poly(fronts)
    if not poly:
        return []
    k = Canvas(f"berm_{HO.name(key)}_{var}")
    xs = [-1.0 + 2 * i / (2 * N) for i in range(2 * N + 1)]
    Z = {}
    for y in xs:
        for x in xs:
            g = _dist(poly, fronts, Vector((x, y)))
            Z[(x, y)] = None if g is None else _height(g[0], g[1], x, y, var)
    top = max((z for z in Z.values() if z is not None), default=0.0) or 1.0
    up = Vector((0, 0, 1))
    for j in range(2 * N):
        for i in range(2 * N):
            a0, a1, b1, b0 = (xs[i], xs[j]), (xs[i + 1], xs[j]), (xs[i + 1], xs[j + 1]), (xs[i], xs[j + 1])
            for tr in ((a0, a1, b1), (a0, b1, b0)):
                zs = [Z[p] for p in tr]
                if any(z is None for z in zs) or max(zs) < EPS / core.ZPX:
                    continue
                pts = [Vector((p[0], p[1], gbase(*p) + z)) for p, z in zip(tr, zs)]
                nn = (pts[1] - pts[0]).cross(pts[2] - pts[0])
                nn = nn.normalized() if nn.length > 1e-12 else up
                if nn.z < 0:
                    nn = -nn
                cx, cy = sum(p.x for p in pts) / 3, sum(p.y for p in pts) / 3
                polyg(k, pts, _col(nn, cx, cy, sum(zs) / 3 / (H0 / core.ZPX)), up)
    _stones(k, poly, fronts, key, var)
    objs = k.build()
    return objs


def _stones(k, poly, fronts, key, var):
    """Loose stones on the slope (rockwall.skirt_stones' chunky lumps), clear of the stretch's ends."""
    r = rng(9000 + sum(map(ord, key)) + 101 * var)
    want = int(r.integers(*STONES))
    placed = 0
    for _ in range(want * 20):
        if placed >= want:
            break
        x, y = r.uniform(-0.7, 0.9), r.uniform(-0.7, 0.9)
        g = _dist(poly, fronts, Vector((x, y)))
        if g is None or g[1] < 0.35 or not (CREST * 0.6 < g[0] < REACH * 0.9):
            continue
        z = gbase(x, y) + _height(g[0], g[1], x, y, var)
        rr = r.uniform(0.045, 0.075)
        c = Vector((x, y, z - rr * 0.2))
        n = Vector((0, 0, 1))
        u, v = Vector((1, 0, 0)), Vector((0, 1, 0))
        pts = [c + (u * math.cos(t) * r.uniform(0.75, 1.2) + v * math.sin(t) * r.uniform(0.6, 1.0)) * rr
               for t in np.linspace(0, TAU, 7, endpoint=False) + r.uniform(0, 1)]
        mid = [c + (p - c) * 0.6 + n * rr * r.uniform(0.35, 0.55) for p in pts]
        top = c + n * rr * r.uniform(0.6, 0.85) + u * r.uniform(-0.2, 0.2) * rr
        col = STONE[int(r.integers(0, 4))]
        for a, b, ma, mb in zip(pts, pts[1:] + pts[:1], mid, mid[1:] + mid[:1]):
            lit = ((a + b) / 2 - c).y > 0
            quad(k, a, b, mb, ma, col if lit else "rkD", (a + b) / 2 - c + n * 0.01)
            tri(k, ma, mb, top, "rkL", (ma + mb) / 2 - c + n * 0.02)
        placed += 1
