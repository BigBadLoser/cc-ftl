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

H0 = 6.5                            # px: the ridge's crest over the deck (the foot step's top is 4 px)
CREST = 0.07                        # tiles out from the outline: the crest (over the step, 3/32 + a block proud)
REACH = 0.42                        # tiles out from the outline: where it has fallen to the ground (a third of a tile
                                    # past the step), give or take WOBBLE
WOBBLE = 0.07
N = 48                              # surface grid cells per tile
STONES = (3, 6)                     # loose stones per tile
STONE = ("rkL", "rk", "rkM", "rk")
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
    """Distance out from this tile's stretch of outline (a visible front's edge, or the wedge round a convex corner
    between two), or None where another tile's stretch owns p (or it is inside the ship, or behind a far front)."""
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
            best = d if best is None else min(best, d)
    for j, (v, lab) in enumerate(poly):                 # convex corners: a vertex between two front edges
        prev = poly[j - 1][1]
        if lab is None or prev is None or lab == prev:
            continue
        n1, n2 = fronts[prev][0], fronts[lab][0]
        q = p - v
        if q.dot(n1) > 0 and q.dot(n2) > 0 and fronts[prev][2] and fronts[lab][2]:
            best = q.length if best is None else min(best, q.length)       # (in a strip the edge's own is nearer)
    return best


def _height(d, x, y):
    """The ridge over the ground at distance d out from the outline (tiles of height)."""
    reach = REACH + WOBBLE * per2(x * 2, y * 2, 811, n=3) / 1.5
    h0 = (H0 + 1.2 * per2(x * 3, y * 3, 813, n=3)) / core.ZPX
    if d < CREST:
        f = 1.0 - 0.15 * (1 - d / CREST)                # (it leans on the wall: a touch lower at the foot)
    else:
        r = min(1.0, (d - CREST) / max(0.05, reach - CREST))
        f = (1 - r) ** 1.6 * (1 + 0.6 * r)
    lump = 0.22 * per2(x * 4, y * 4, 817, n=5) + 0.06 * per2(x * 8, y * 8, 819, n=4)
    return max(0.0, h0 * f * (1 + lump * min(1.0, f * 3)))


def _col(n, x, y):
    """Tone by facing (lit from +y and over), mottled."""
    s = n.z * 0.7 + n.y * 0.45 - n.x * 0.15 + 0.04 * per2(x * 3, y * 3, 823, n=3)
    return "gdL" if s > 0.86 else "gd" if s > 0.66 else "gdM" if s > 0.42 else "gdD"


def berm(key):
    """The berm's objects for a tile with this key (none if no visible front of it has any)."""
    fronts = _fronts(key)
    if not any(f[2] for f in fronts):
        return []
    poly = _poly(fronts)
    if not poly:
        return []
    k = Canvas(f"berm_{HO.name(key)}")
    xs = [-1.0 + 2 * i / (2 * N) for i in range(2 * N + 1)]
    Z = {}
    for y in xs:
        for x in xs:
            d = _dist(poly, fronts, Vector((x, y)))
            Z[(x, y)] = None if d is None else _height(d, x, y)
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
                polyg(k, pts, _col(nn, cx, cy), up)
    _stones(k, poly, fronts, key)
    objs = k.build()
    return objs


def _stones(k, poly, fronts, key):
    """Loose stones on the slope (rockwall.skirt_stones' chunky lumps)."""
    r = rng(9000 + sum(map(ord, key)))
    want = int(r.integers(*STONES))
    placed = 0
    for _ in range(want * 20):
        if placed >= want:
            break
        x, y = r.uniform(-0.7, 0.9), r.uniform(-0.7, 0.9)
        d = _dist(poly, fronts, Vector((x, y)))
        if d is None or not (CREST * 0.6 < d < REACH * 0.95):
            continue
        z = gbase(x, y) + _height(d, x, y)
        rr = r.uniform(0.03, 0.055)
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
            quad(k, a, b, mb, ma, col if lit else "rkM", (a + b) / 2 - c + n * 0.01)
            tri(k, ma, mb, top, "rkL" if lit else col, (ma + mb) / 2 - c + n * 0.02)
        placed += 1
