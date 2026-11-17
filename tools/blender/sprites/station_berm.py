"""MOCK (asteroid base, #524): dust and rock built up against a ground base's station hull, after the user's station
hull reference (#1149: rubble along the hull's foot). One sprite per hull key and variant,
tile.hull.station.berm.<key name>.v<n>, drawn over the tile's hull piece.

A drift of the asteroid's dust (rock_ground's tones) leaning on the hull's foot, burying its step, and falling away in a
concave scree slope; heaped high in places and thinning to almost nothing in others, its edge ragged; rocks half buried
in it (crowded near the wall, lit on top) and pebbles scattered past its toe. Its height is a function of the distance
out from the ship's outline (the key's fronts), so runs, corners and diagonals meet: each tile draws the drift whose
foot lies on its own stretch of outline (and the wedge round a convex corner). Rendered with the tile's hull piece as a
holdout, so where the hull stands in front of it the berm is hidden."""
import math

import numpy as np
from mathutils import Vector

from . import core
from . import hull_outline as HO
from .rock_base import TAU, Canvas, gbase, per2, polyg, rng, tri

H0 = 8.0                            # px: the drift against the wall, on average (the foot step's top is 4 px)
H_SWING = 0.6                       # how far that heaps up and thins along the wall (a share of H0, each way)
STEP = 0.14                         # tiles out from the outline: the foot step front (3/32, its blocks a 32nd more)
REACH = 0.46                        # tiles out from the outline: where it has thinned to the ground, on average
REACH_SWING = 0.2                  # give or take
MOUNDS = (1, 3)                     # heaps in the drift per tile and variant (and one more)
VARIANTS = 3                        # per key, picked per tile; each its own heaps, reach and rocks, faded to the shared
VAR_SHARE = 0.8                     # shape at its stretch's ends so neighbours of any variant meet
N = 48                              # surface grid cells per tile
ROCKS = (4, 7)                      # rocks half buried in the drift, per tile and variant
PEBBLES = (4, 8)                    # pebbles past its toe
EPS = 0.25                          # px: a facet all under this over the ground is not drawn (the ground shows)


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


def _mounds(poly, fronts, r):
    """Heaps in the drift: (x, y, radius, lift), centred on the stretch near the wall (lift a share of H0)."""
    out = []
    for _ in range(200):
        if len(out) >= int(r.integers(*MOUNDS)) + 1:
            break
        x, y = r.uniform(-0.75, 0.95), r.uniform(-0.75, 0.95)
        g = _dist(poly, fronts, Vector((x, y)))
        if g is None or g[1] < 0.35 or not 0.02 < g[0] < 0.3:
            continue
        out.append((x, y, r.uniform(0.09, 0.2), r.uniform(0.4, 1.0)))
    return out


def _height(d, w, x, y, mounds):
    """The drift over the ground at distance d out from the outline (tiles of height); w: the variant's share (its
    mounds fade out toward the stretch's ends)."""
    heap = 0.75 * per2(x * 1.5, y * 1.5, 811, n=3) / 2.2                                 # along the wall (shared)
    lift = sum(m[3] * math.exp(-((x - m[0]) ** 2 + (y - m[1]) ** 2) / m[2] ** 2) for m in mounds) * w
    h0 = H0 * max(0.15, 1 + H_SWING * heap + lift) / core.ZPX
    reach = max(0.12, REACH + REACH_SWING * heap + 0.05 * per2(x * 4, y * 4, 815, n=4) + 0.3 * lift)
    r = max(0.0, d - STEP) / max(0.08, reach - STEP)   # (full height over the step, then a concave scree)
    if r >= 1:
        return 0.0
    f = (1 - r) ** 2.0
    return max(0.0, h0 * f * (1 + 0.06 * per2(x * 5, y * 5, 817, n=4)))


def _col(n, x, y):
    """Dust by steepness (both near faces alike, as the station hull lights them): the flatter, the lighter, in broad
    soft patches; a slope turned from the camera (toward the wall) the dark."""
    if n.x + n.y < -0.35:
        return "gdD"
    t = n.z + 0.05 * per2(x * 4, y * 4, 823, n=3)
    return "gdL" if t > 0.96 else "gd" if t > 0.84 else "gdM" if t > 0.64 else "gdD"


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
    r = rng(9000 + sum(map(ord, key)) + 101 * var)
    mounds = _mounds(poly, fronts, r)
    Z = {}
    for y in xs:
        for x in xs:
            g = _dist(poly, fronts, Vector((x, y)))
            Z[(x, y)] = None if g is None else _height(g[0], g[1], x, y, mounds)
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
    _scatter(k, poly, fronts, mounds, r, int(r.integers(*ROCKS)), (0.04, 0.1), (0.0, 0.85), 0.4)
    _scatter(k, poly, fronts, mounds, r, int(r.integers(*PEBBLES)), (0.014, 0.03), (0.7, 1.35), 0.15)
    return k.build()


def _scatter(k, poly, fronts, mounds, r, want, size, band, sink):
    """want rocks of radius in size, at distances out in band (shares of the reach there), sunk by sink of their height
    into the drift; nearer the wall more likely. Each clear of its stretch's ends (no rock cut at a tile's edge)."""
    placed = 0
    for _ in range(want * 30):
        if placed >= want:
            break
        x, y = r.uniform(-0.75, 0.95), r.uniform(-0.75, 0.95)
        g = _dist(poly, fronts, Vector((x, y)))
        if g is None or g[1] < 0.3:
            continue
        reach = REACH + REACH_SWING * 0.6 * (0.75 * per2(x * 1.5, y * 1.5, 811, n=3) / 2.2)
        q = max(0.0, g[0] - STEP * 0.5) / max(0.12, reach - STEP * 0.5)
        if not band[0] <= q <= band[1] or r.uniform() < q * 0.5:
            continue
        rr = r.uniform(*size) * (1.15 - 0.4 * min(1.0, q))
        _rock(k, Vector((x, y, gbase(x, y) + _height(g[0], g[1], x, y, mounds))), rr, r, sink)
        placed += 1


def _rock(k, c, rr, r, sink):
    """A lumpy rock: a ring, a shoulder ring and a top, faced by its normals (lit on top, the rock's tones down its
    sides, dark turned from the camera)."""
    up = Vector((0, 0, 1))
    c = c - up * rr * sink
    a0 = r.uniform(0, 1)
    ring = [c + Vector((math.cos(t) * r.uniform(0.75, 1.2), math.sin(t) * r.uniform(0.7, 1.15), 0)) * rr
            for t in np.linspace(0, TAU, 7, endpoint=False) + a0]
    mid = [c + (p - c) * r.uniform(0.6, 0.8) + up * rr * r.uniform(0.45, 0.7) for p in ring]
    top = c + up * rr * r.uniform(0.8, 1.05) + Vector((r.uniform(-0.25, 0.25), r.uniform(-0.25, 0.25), 0)) * rr

    def face(pts):
        n = (pts[1] - pts[0]).cross(pts[2] - pts[0])
        n = n.normalized() if n.length > 1e-12 else up
        mid_p = sum(pts, Vector()) / len(pts)
        if n.dot(mid_p - c) < 0:
            n = -n
        col = ("gdL" if n.z > 0.8 else "rkL" if n.z > 0.45 else "rkM" if n.x + n.y > 0.2 else "rkD" if n.x + n.y > -0.3
               else "rkK")
        polyg(k, pts, col, n)
    for a, b, ma, mb in zip(ring, ring[1:] + ring[:1], mid, mid[1:] + mid[:1]):
        face([a, b, mb, ma])
        face([ma, mb, top])
