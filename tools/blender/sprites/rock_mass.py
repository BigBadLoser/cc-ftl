"""Asteroid rock: the rock mass tile, about 1.2 tiles high, with stepped strata cliffs on its open sides, a cliff foot
standing back on levelled ground, inner-corner cuts, and ore veins (rock_ore.py) on ore tiles."""
import math

import numpy as np
from mathutils import Vector

from .rock_base import (MIN_INSET, NG, SEED, SIDES, TAU, ZM, corner_terms, edge_dist, gbase, per1, per2, polyg, rng, smin,
                        strata_faces, terrace, tri, tri1, window)
from .rock_crater import crater_col, crater_set
from .rock_ore import ore_features


class MassTile:
    def __init__(self, mask, var, corners=0, ore=None):
        self.mask, self.var, self.corners, self.ore = mask, var, corners, ore
        r = rng(1000 + var * 17 + mask)
        self.craters = crater_set(r)
        self.cracks = []
        for _ in range(int(r.integers(1, 3))):
            p = Vector((r.uniform(-0.3, 0.3), r.uniform(-0.3, 0.3)))
            pts = [p.copy()]
            a = r.uniform(0, TAU)
            for _ in range(4):
                a += r.uniform(-0.8, 0.8)
                p = p + Vector((math.cos(a), math.sin(a))) * r.uniform(0.06, 0.12)
                pts.append(p.copy())
            self.cracks.append(pts)
        self.chunks = [(r.uniform(-0.25, 0.25), r.uniform(-0.25, 0.25), r.uniform(0.035, 0.06), int(r.integers(0, 99)))
                       for _ in range(int(r.integers(0, 3)))]

    def open(self, side):
        return not (self.mask & dict(SIDES)[side])

    def edge_w(self, side, t):
        """How far in from an open edge the rock reaches full height: a shared repeat plus this variant's own wobble,
        windowed so tiles meet at their corners."""
        w1 = math.cos(math.pi * t) ** 2
        return (0.24 + 0.045 * tri1(t, SEED[side], n=5)
                + 0.07 * w1 * tri1(t, SEED[side] * 7 + self.var * 31 + 3, n=4))

    def base_inset(self, side, t):
        """Where the cliff's foot stands back from the tile edge, leaving a strip of levelled ground (0 at the
        corners, so the foot still meets the next tile's)."""
        amp = (0.0, 0.1, 0.04, 0.16)[self.var % 4]
        return amp * math.cos(math.pi * t) ** 2 * (0.75 + 0.25 * tri1(t, SEED[side] * 5 + self.var, n=3))

    def ledge_at(self, side, t):
        w1 = math.cos(math.pi * t) ** 2
        return 0.42 + 0.08 * per1(t, SEED[side] + 5, n=4) + 0.06 * w1 * per1(t, self.var * 13 + SEED[side], n=3)

    def fall(self, x, y):
        """0 at an open edge (or a cut inner corner) rising to 1 at full height: a smooth union, so convex corners
        round off and cut corners curve round as a concave fillet."""
        terms = []
        for side, _ in SIDES:
            if self.open(side):
                dist, t = edge_dist(side, x, y)
                terms.append((max(0.0, dist - MIN_INSET - self.base_inset(side, t)) / max(0.05, self.edge_w(side, t)),
                              self.ledge_at(side, t)))
        for dist, a, (s1, t1), (s2, t2) in corner_terms(self.corners, x, y):
            w = (1 - a) * self.edge_w(s1, t1) + a * self.edge_w(s2, t2)
            terms.append((max(0.0, dist - MIN_INSET) / w, (1 - a) * self.ledge_at(s1, t1) + a * self.ledge_at(s2, t2)))
        got = smin(terms)
        if got is None:
            return 1.0
        q, (ledge,) = got
        # a stepped cliff: a steep lower wall, a ledge, a steep upper wall, a rounded lip
        if q < 0.32:
            return ledge * (q / 0.32) ** 0.6
        if q < 0.5:
            return ledge + 0.08 * (q - 0.32) / 0.18
        r = min(1.0, (q - 0.5) / 0.4)
        return ledge + 0.08 + (1 - ledge - 0.08) * (1 - (1 - r) ** 2.5)

    def h(self, x, y):
        g, w = gbase(x, y), window(x, y)
        base = ZM + 0.012 * per2(x, y, 5)
        own = (w * (0.02 * per2(x, y, 100 + self.var) + 0.012 * per2(x * 3, y * 3, 120 + self.var, n=6))
               + w ** 0.4 * sum(c.h(x, y) for c in self.craters))
        f = self.fall(x, y)
        ledge = (0.04 * per2(x * 2, y * 2, 200) + 0.03 * w * per2(x * 2, y * 2, 210 + self.var)) * (1 - f) * f * 4
        z = g + (base + own - g) * f + ledge
        if f < 0.97:                                                                      # strata steps in the cliff
            b = 0.6 * min(1.0, (0.97 - f) / 0.12)
            z = z + (terrace(z) - z) * b
        if self.ore and self.ore.kind == "iron" and f > 0.9:                               # iron veins stand proud
            z += (0.016 if self.ore.rich else 0.008) * self.ore.strength(x, y, z)
        return max(g, z)

    def crack(self, x, y):
        if window(x, y) < 0.25:
            return False
        p = Vector((x, y))
        for pts in self.cracks:
            for a, b in zip(pts, pts[1:]):
                ab = b - a
                t = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
                if (a + ab * t - p).length < 0.014:
                    return True
        return False


def mass(k, tile, ox, oy):
    """One rock-mass tile into k at local offset (ox, oy)."""
    O = Vector((ox, oy, 0))
    xs = [-0.5 + i / NG for i in range(NG + 1)]
    P = [[Vector((x, y, tile.h(x, y))) for x in xs] for y in xs]
    pal = ("rkL", "rk", "rkM", "rkD")
    up = Vector((0, 0, 1))
    for j in range(NG):
        for i in range(NG):
            a0, a1, b1, b0 = P[j][i], P[j][i + 1], P[j + 1][i + 1], P[j + 1][i]
            cx, cy = (a0.x + b1.x) / 2, (a0.y + b1.y) / 2
            zc = (a0.z + b1.z + a1.z + b0.z) / 4
            for tr in ((a0, a1, b1), (a0, b1, b0)):                                       # triangles: the strata
                if all(p.z - gbase(p.x, p.y) < 0.003 for p in tr):
                    continue                                                              # the foot: the ground's
                n = (tr[1] - tr[0]).cross(tr[2] - tr[0]).normalized()                     # cuts stay planar
                if n.z < 0:
                    n = -n
                if tile.ore:
                    tc = (tr[0] + tr[1] + tr[2]) / 3
                    if tile.ore.strength(tc.x, tc.y, tc.z) > 0:
                        polyg(k, [p + O for p in tr], tile.ore.col(n, tc.x, tc.y, tc.z), up)
                        continue
                col = None
                if zc - gbase(cx, cy) < 0.012 and n.z > 0.95:                             # levelled ground at an
                    col = "gdM" if per2(cx, cy, 13, n=3) > 1.0 else "gd"                      # inset foot
                elif n.z > 0.8 and zc > ZM * 0.8 and tile.crack(cx, cy):                  # cracks: on the top only
                    col = "rkK"
                elif n.z > 0.55 and zc > ZM * 0.8:
                    col = crater_col(tile.craters, cx, cy, pal)
                if col:
                    pass
                elif n.z > 0.9 or (n.z > 0.6 and zc > ZM * 0.85):                         # the top: mottled
                    mt = per2(cx * 3, cy * 3, 7 + tile.var) + 0.6 * per2(cx * 7, cy * 7, 60 + tile.var, n=4)
                    col = "rkL" if mt > 1.3 else ("rkM" if mt < -1.4 else "rk")
                elif n.z > 0.72:
                    col = "rk"                                                            # strata ledges catch light
                else:
                    strata_faces(k, [p + O for p in tr], up)
                    continue
                polyg(k, [p + O for p in tr], col, up)
    if tile.ore:
        ore_features(k, tile, O)
    for cx, cy, rr, sd in tile.chunks:                                                    # loose chunks on top
        r = rng(sd)
        z = tile.h(cx, cy)
        c = Vector((cx, cy, z)) + O
        pts = [c + Vector((math.cos(a) * rr * r.uniform(0.7, 1.2), math.sin(a) * rr * r.uniform(0.7, 1.2), 0))
               for a in np.linspace(0, TAU, 6, endpoint=False)]
        top = c + Vector((r.uniform(-0.01, 0.01), r.uniform(-0.01, 0.01), rr * 1.1))
        for a, b in zip(pts, pts[1:] + pts[:1]):
            tri(k, a, b, top, "rkL" if (a.y + b.y) / 2 > c.y else "rkM", (a + b) / 2 + Vector((0, 0, 0.02)) - c)
