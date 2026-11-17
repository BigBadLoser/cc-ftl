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
H_MIN = 0.7                         # the drift never thins under this share of H0 at the wall (it buries the step)
H_SWING = 0.3                       # how far that heaps up and thins along the wall (a share of H0, each way)
STEP = 0.14                         # tiles out from the outline: the foot step front (3/32, its blocks a 32nd more)
REACH = 0.46                        # tiles out from the outline: where it has thinned to the ground, on average
REACH_SWING = 0.12                 # give or take
END_LIFT, END_R = 0.75, 0.3          # a heap straddling a run's type-1 tile boundary: its lift (a share of H0), radius
# The variants' characters (mounds: count range; lift: their height's scale; big: a clump's main rock's radius range
# and the chance of one, or None; rocks: its small companions' count range; pebbles: count range; prof: the drift's
# profile out from the wall: (reach change in tiles, a, b: the fall (1 - r^a)^b, height change as a share of H0), all
# faded to the shared shape at the stretch's ends). A straight run has RUN of them: 0-3 with a rock clump, 4-7 bare
# (the renderer puts a clump on one tile in every three and never the same variant on two neighbours); any other key
# the first VARIANTS.
RUN_CHARACTER = (
    {"mounds": (1, 3), "lift": 1.0, "big": ((0.12, 0.15), 1.0), "rocks": (1, 4), "pebbles": (3, 6),
     "prof": (0.0, 1.0, 2.0, 0.0)},                                          # ordinary
    {"mounds": (1, 2), "lift": 0.8, "big": ((0.15, 0.18), 1.0), "rocks": (0, 3), "pebbles": (2, 4),
     "prof": (0.12, 2.0, 1.2, 0.15)},                                        # a boulder in a bulging bank
    {"mounds": (1, 3), "lift": 0.9, "big": ((0.10, 0.13), 1.0), "rocks": (2, 4), "pebbles": (3, 6),
     "prof": (-0.12, 1.0, 2.6, 0.1)},                                        # a rock pile on a steep short one
    {"mounds": (2, 4), "lift": 0.5, "big": ((0.13, 0.16), 1.0), "rocks": (0, 2), "pebbles": (4, 8),
     "prof": (0.25, 1.0, 3.2, -0.25)},                                       # a rock out on a long shallow fan
    {"mounds": (1, 3), "lift": 1.0, "big": ((0.07, 0.09), 0.3), "rocks": (0, 1), "pebbles": (3, 6),
     "prof": (0.15, 2.2, 1.0, 0.1)},                                         # bulging
    {"mounds": (1, 2), "lift": 0.6, "big": ((0.07, 0.09), 0.2), "rocks": (0, 1), "pebbles": (2, 5),
     "prof": (-0.14, 1.2, 2.0, -0.1)},                                       # steep and short
    {"mounds": (2, 4), "lift": 0.35, "big": None, "rocks": (0, 1), "pebbles": (6, 10),
     "prof": (0.3, 1.0, 3.4, -0.3)},                                         # a long low fan
    {"mounds": (2, 3), "lift": 1.0, "big": ((0.07, 0.09), 0.3), "rocks": (0, 1), "pebbles": (3, 6),
     "prof": (0.0, 1.4, 1.6, 0.0)})                                          # lumpy
CHARACTER = (
    {"mounds": (1, 3), "lift": 1.0, "big": ((0.12, 0.15), 0.35), "rocks": (1, 4), "pebbles": (3, 6),
     "prof": (0.0, 1.0, 2.0, 0.0)},
    {"mounds": (1, 2), "lift": 0.8, "big": ((0.15, 0.18), 0.5), "rocks": (0, 3), "pebbles": (2, 4),
     "prof": (0.12, 2.0, 1.2, 0.15)},
    {"mounds": (2, 4), "lift": 0.35, "big": ((0.07, 0.09), 0.15), "rocks": (0, 1), "pebbles": (6, 10),
     "prof": (0.2, 1.0, 3.0, -0.2)})
RUN = len(RUN_CHARACTER)
SMALL = (0.045, 0.07)               # tiles: a companion rock's radius range
CLUMP = 0.11                        # tiles: a clump's spread (its rocks gather round one spot, the boulder's if any)
VARIANTS = len(CHARACTER)           # per key but a straight run's, picked per tile; each its own heaps, reach and rocks,
VAR_SHARE = 0.8                     # faded to the shared shape at its stretch's ends so neighbours of any variant meet
N = 32                              # surface grid cells per tile
LIP = 0.40 + 2 / core.ZPX           # the dust banked up the wall's face to just under its groove (station_hull.GROOVE):
LIP_W = 0.16                        # the face's lower band between drift and groove read as a gap; out this far
INNER = 0.08                        # tiles: the drift runs on this far in under a front's face (the hull hides it there),
                                    # so a diagonal's grid cells crossing the wall line leave no bare stair along its foot
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


def _cross(a, b):
    return a.x * b.y - a.y * b.x


def _dist(poly, fronts, p, turns=()):
    """(distance out from this tile's stretch of outline, the variant window there), or None where another tile's
    stretch owns p (or it is inside the ship, or behind a far front). The stretch: a visible front's edge (the window
    sin^2 along it: 0 at its ends, where the next tile's variant takes over), or the wedge round a convex corner between
    two (window 0), or round a turn: where the outline bends at the tile's edge into a neighbour's straight wall (turns:
    (vertex, the two normals); the neighbour's band and this one meet along the wedge's sides). A front turned from the
    camera has its drift too (the hull hides it but where it wraps round a far corner)."""
    best, inner = None, None
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
            if d > -INNER and -1e-9 <= t <= 1 + 1e-9 and all(f[0].dot(p) <= f[1] for f in fronts):
                w = math.sin(math.pi * max(0.0, min(1.0, t))) ** 2 * min(1.0, math.sqrt(L2) / 0.5)
                inner = (0.0, w) if inner is None or w > inner[1] else inner
            continue
        if -1e-9 <= t <= 1 + 1e-9:
            w = math.sin(math.pi * max(0.0, min(1.0, t))) ** 2 * min(1.0, math.sqrt(L2) / 0.5)
            best = (d, w) if best is None or d < best[0] else best
    for j, (v, lab) in enumerate(poly):                 # convex corners: a vertex between two front edges
        prev = poly[j - 1][1]
        if lab is None or prev is None or lab == prev:
            continue
        n1, n2 = fronts[prev][0], fronts[lab][0]
        q = p - v
        if q.dot(n1) > 0 and q.dot(n2) > 0:
            if best is None or q.length < best[0]:      # (in a strip the edge's own is nearer)
                best = (q.length, 0.0)
    for v, n1, n2 in turns:
        q = p - v
        sg = _cross(n1, n2)
        if _cross(n1, q) * sg >= 0 and _cross(q, n2) * sg >= 0 and (best is None or q.length < best[0]):
            best = (q.length, 0.0)
    return best if best is not None or not all(f[0].dot(p) <= f[1] for f in fronts) else inner


def _turns(key, poly, fronts, ends):
    """A single diagonal front's turns (see _dist): ends[0] the vertex on a top or bottom tile edge (the outline goes on
    into a wall along y: normal (sx, 0)), ends[1] the one on a side edge (normal (0, sy)); only a convex bend (the
    neighbour's wall on this front's ship side) wedges."""
    if turn_key(key) is None:
        return []
    n, c, _ = fronts[0]
    out = []
    for j, (a, lab) in enumerate(poly):
        if lab != 0:
            continue
        for v in (a, poly[(j + 1) % len(poly)][0]):
            if abs(abs(v.y) - 0.5) < 1e-6 and ends[0]:
                nv, out_d = Vector((math.copysign(1, n.x), 0)), Vector((0, math.copysign(1, v.y)))
            elif abs(abs(v.x) - 0.5) < 1e-6 and ends[1]:
                nv, out_d = Vector((0, math.copysign(1, n.y))), Vector((math.copysign(1, v.x), 0))
            else:
                continue
            if n.dot(v + out_d * 0.3) - c < 0:          # (the neighbour's wall runs on inside this front: convex)
                out.append((v.copy(), n, nv))
    return out


def turn_key(key):
    """A single diagonal front (its ends can turn into a straight neighbour's wall), else None."""
    st = HO.parse(key)
    if len(st) != 1 or len(st[0]) != 1:
        return None
    (sx, sy), _ = st[0][0]
    return (sx, sy) if sx and sy else None


def _mounds(poly, fronts, r, ch):
    """Heaps in the drift: (x, y, radius, lift), centred on the stretch near the wall (lift a share of H0)."""
    out, want = [], int(r.integers(*ch["mounds"]))
    for _ in range(200):
        if len(out) >= want:
            break
        x, y = r.uniform(-0.75, 0.95), r.uniform(-0.75, 0.95)
        g = _dist(poly, fronts, Vector((x, y)))
        if g is None or g[1] < 0.35 or not 0.02 < g[0] < 0.3:
            continue
        out.append((x, y, r.uniform(0.14, 0.26), r.uniform(0.3, 0.75) * ch["lift"]))
    return out


def _ends_lift(u, ends):
    """The heaps on the stretch's ends (a run's tile boundaries: ends[0] at u = -0.5, ends[1] at +0.5): a heap
    centred on a type-1 boundary, the same in the tiles either side of it (a function of the distance to it alone)."""
    return sum(END_LIFT * math.exp(-((u - c) / END_R) ** 2) for c, e in zip((-0.5, 0.5), ends) if e)


def _height(d, w, x, y, mounds, u=None, ends=(0, 0), prof=(0.0, 1.0, 2.0, 0.0)):
    """The drift over the ground at distance d out from the outline (tiles of height); w: the variant's share (its
    mounds fade out toward the stretch's ends); u: the position along a straight run (its ends' heaps); prof: the
    variant's profile (see CHARACTER), faded in by w."""
    heap = 0.75 * per2(x * 1.5, y * 1.5, 811, n=3) / 2.2                                 # along the wall (shared)
    lift = sum(m[3] * math.exp(-((x - m[0]) ** 2 + (y - m[1]) ** 2) / m[2] ** 2) for m in mounds) * w
    lift += _ends_lift(u, ends) if u is not None else 0.0
    lift = 1.1 * math.tanh(lift / 1.1)                  # (heaps on heaps round off: no cones)
    dr, a, b, dh = prof
    h0 = H0 * max(H_MIN, 1 + H_SWING * heap + lift + w * dh) / core.ZPX
    reach = max(0.12, REACH + REACH_SWING * heap + 0.05 * per2(x * 4, y * 4, 815, n=4) + 0.3 * lift + w * dr)
    r = max(0.0, d - STEP) / max(0.08, reach - STEP)   # (full height over the step, then a concave scree)
    if r >= 1:
        return 0.0
    a, b = 1 + w * (a - 1), 2 + w * (b - 2)           # (concave scree at a = 1, b = 2; a dome as a grows)
    f = (1 - r ** a) ** b
    lip = LIP * max(0.0, 1 - max(d, 0.0) / LIP_W) ** 1.6       # (banked steep against the face, over the step)
    return max(0.0, h0 * f, lip)


def _col(n, x, y, frac):
    """Dust in broad calm patches, not per facet (a facet is under a px: by its own normal the dust speckles and the
    rocks drown in it): by height up the drift (frac: 0 at the toe, 1 at the wall's height), patchy, its toe the
    ground's own tone (no outline); only a really steep slope shaded, one turned from the camera the dark."""
    if n.x + n.y < -0.5:
        return "bgM"
    t = frac + 0.18 * per2(x * 2.5, y * 2.5, 823, n=3) / 1.5
    if n.z < 0.45:
        return "bgL" if frac > 1.2 else "bg"           # (steep: the light dims it; banked on the wall lit)
    return "bgL" if t > 0.6 else "bg"


def along(key):
    """A straight run's along-run coordinate (x or y), or None (a corner, a diagonal: plain ends)."""
    st = HO.parse(key)
    if len(st) != 1 or len(st[0]) != 1:
        return None
    (sx, sy), _ = st[0][0]
    return 0 if sx == 0 else 1 if sy == 0 else None


def berm(key, var=0, ends=(0, 0)):
    """The berm's objects for a tile with this key in variant var (none if no visible front of it has any); ends: a
    straight run's boundary types at its lower and higher coordinate ends (1 a heap straddling the boundary), or a
    diagonal's turns (see _turns: 1 where its neighbour there is a straight wall)."""
    ax = along(key)
    ch = RUN_CHARACTER[var % RUN] if ax is not None else CHARACTER[var % VARIANTS]
    U = (lambda x, y: (x, y)[ax]) if ax is not None else (lambda x, y: None)
    fronts = _fronts(key)
    if not any(f[2] for f in fronts):
        return []
    poly = _poly(fronts)
    if not poly:
        return []
    turns = _turns(key, poly, fronts, ends)
    k = Canvas(f"berm_{HO.name(key)}_{var}_{ends[0]}{ends[1]}")
    xs = [-1.0 + 2 * i / (2 * N) for i in range(2 * N + 1)]
    r = rng(9000 + sum(map(ord, key)) + 101 * var + 13 * (2 * ends[0] + ends[1]))   # (each end type its own rocks)
    mounds = _mounds(poly, fronts, r, ch)
    Z = {}
    for y in xs:
        for x in xs:
            g = _dist(poly, fronts, Vector((x, y)), turns)
            Z[(x, y)] = None if g is None else _height(g[0], g[1], x, y, mounds, U(x, y), ends, ch["prof"])
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
    hz = lambda g, x, y: _height(g[0], g[1], x, y, mounds, U(x, y), ends, ch["prof"])    # noqa: E731
    # the rocks in one clump: a big one, a companion or two round it (a stretch without one stays bare)
    size, p = ch["big"] or (None, 0.0)
    at = _scatter(k, poly, fronts, hz, r, 1, size, (0.05, 0.75), 0.2, wmin=0.3) if r.uniform() < p else []
    if at:
        _scatter(k, poly, fronts, hz, r, int(r.integers(*ch["rocks"])), SMALL, (0.0, 0.9), 0.3, near=at[0])
    _scatter(k, poly, fronts, hz, r, int(r.integers(*ch["pebbles"])), (0.014, 0.03), (0.7, 1.35), 0.15)
    return k.build()


def _scatter(k, poly, fronts, hz, r, want, size, band, sink, wmin=0.3, near=None):
    """want rocks of radius in size (None: just pick the spot), at distances out in band (shares of the reach there),
    sunk by sink of their height into the drift; nearer the wall more likely, round `near` (a clump) if given. Each
    clear of its stretch's ends (no rock cut at a tile's edge). Returns where they went."""
    placed = []
    for _ in range(want * 200):
        if len(placed) >= want:
            break
        if near is None:
            x, y = r.uniform(-0.75, 0.95), r.uniform(-0.75, 0.95)
        else:
            x, y = near[0] + r.normal(0, CLUMP), near[1] + r.normal(0, CLUMP)
        g = _dist(poly, fronts, Vector((x, y)))
        if g is None or g[1] < wmin:
            continue
        reach = REACH + REACH_SWING * 0.6 * (0.75 * per2(x * 1.5, y * 1.5, 811, n=3) / 2.2)
        q = max(0.0, g[0] - STEP * 0.5) / max(0.12, reach - STEP * 0.5)
        if not band[0] <= q <= band[1] or r.uniform() < q * 0.5:
            continue
        if size:
            rr = r.uniform(*size) * (1.15 - 0.4 * min(1.0, q))
            _rock(k, Vector((x, y, gbase(x, y) + hz(g, x, y))), rr, r, sink)
        placed.append((x, y))
    return placed


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
        # (a light top, then two dark sides, the one toward x darker: an iso stone reads by its value steps, and its
        # sides stay darker than any dust so it stands out of the drift)
        col = "brH" if n.z > 0.6 else "bgM" if n.y >= n.x else "brM"
        polyg(k, pts, col, n)
    for a, b, ma, mb in zip(ring, ring[1:] + ring[:1], mid, mid[1:] + mid[:1]):
        face([a, b, mb, ma])
        face([ma, mb, top])
