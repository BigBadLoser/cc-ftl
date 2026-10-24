"""Asteroid rock: levelled ground with its worn edge toward open space and the asteroid's mass under it (the under-lip),
one sprite. The 47-piece edge set: a neighbour mask of solid tiles plus inner-corner bits."""
import math

import numpy as np
from mathutils import Vector

from .rock_base import (SEED, SIDES, TAU, clip_f, corner_terms, edge_dist, gbase, per1, per2, polyg, rng, strata_faces,
                        terrace, tri, tri1, window)
from .rock_crater import crater_col, crater_set


PAIRS = ((("n", "e"), (0.5, -0.5)), (("e", "s"), (0.5, 0.5)), (("s", "w"), (-0.5, 0.5)), (("w", "n"), (-0.5, -0.5)))
BELLY_K = 0.4                                # the belly rounds more the deeper it goes


class GroundTile:
    """Levelled ground and the asteroid's mass under it, one sprite. mask = neighbours that are solid (rock or ground),
    corners (CORNERS bits) = open diagonals with both sides solid. Toward open space the edge wears back from the tile
    edge (a shared repeat plus this variant's chips, round at convex corners, filleted at inner ones), breaks off in a
    thin band, steps in at a shelf and bellies down and inward about a tile deep in stepped strata, like the cliffs."""
    def __init__(self, var, mask=15, corners=0, plain=False):
        self.var, self.mask, self.corners, self.plain = var, mask, corners, plain
        r = rng(5000 + var)
        self.craters = [] if plain else crater_set(r, big=(0.08, 0.22), n_big=(0, 0, 1, 1, 2), pocks=(1, 5),
                                                   spread=0.22, depth=0.4)
        self.pebbles = [] if plain else [(r.uniform(-0.38, 0.38), r.uniform(-0.38, 0.38), r.uniform(0.015, 0.03),
                                          int(r.integers(0, 99))) for _ in range(int(r.integers(2, 9)))]
        self.scrape = var % 3 == 1 and not plain
        self.scrape_a = r.uniform(0, math.pi)
        rb = rng(7000 + var * 13 + mask)
        self.bites = {s: [] if plain else [(rb.uniform(-0.32, 0.32), rb.uniform(0.07, 0.25), rb.uniform(0.03, 0.12))
                                           for _ in range(int(rb.integers(0, 5)))] for s, _ in SIDES}
        self.k = 0.1 if plain else (0.42, 0.5, 0.45, 0.58)[var % 4]                       # convex corner roundness
        self.bay = 0.0 if plain else (0.03, 0.12, 0.06, 0.2)[(var + 1) % 4]                # how deep the edge bows in
        self.shelf = 0.0 if plain else (0.0, 0.9, 0.5, 0.0, 1.0, 0.3)[var % 6]             # a mid-belly ledge

    def open(self, side):
        return not (self.mask & dict(SIDES)[side])

    def ero(self, side, t):
        """How far the worn edge stands back from an open tile edge. Plain tiles (the ground under rock) stay within
        MIN_INSET, so a cliff's foot always stands on ground; open ground wears deeper, in chipped bites."""
        w1 = math.cos(math.pi * t) ** 2
        e = (0.05 + 0.02 * tri1(t, SEED[side] + 80, n=4)
             + w1 * (0.015 if self.plain else 0.06) * tri1(t, SEED[side] * 11 + self.var * 37, n=3)
             + w1 * self.bay * (0.7 + 0.3 * tri1(t, SEED[side] * 5 + self.var, n=3)))
        for t0, rr, dd in self.bites[side]:                                               # chipped-out bites
            if abs(t - t0) < rr:
                e += w1 * dd * (1 - ((t - t0) / rr) ** 2)
        return min(e, 0.34)

    def lip_params(self, side, t):
        w1 = math.cos(math.pi * t) ** 2
        W = 0.5 + 0.05 * tri1(t, SEED[side] + 50, n=5) + 0.14 * w1 * tri1(t, SEED[side] * 3 + self.var * 29, n=4)
        D = max(0.75, 1.1 + 0.1 * per1(t, SEED[side] + 60, n=4)                           # hanging lobes and bulges
                + w1 * (0.12 * per1(t, self.var * 7 + SEED[side], n=3) + 0.22 * tri1(t, self.var * 19 + SEED[side], n=4)))
        b = 0.1 + 0.045 * tri1(t * 2, SEED[side] + 70, n=3)
        return W, D, b, w1 * self.shelf

    def edge(self, x, y):
        """(signed distance in from the worn edge, the same rounder for the belly, W, D, b, shelf) or None away from
        any open edge. Two open sides meeting at a corner round into each other near that corner only (so where this
        tile meets a solid neighbour the edge is exactly the shared one); inner-corner fillets join by plain min."""
        sides, terms = {}, []
        for side, _ in SIDES:
            if self.open(side):
                dist, t = edge_dist(side, x, y)
                sides[side] = dist - self.ero(side, t)
                terms.append((sides[side], *self.lip_params(side, t)))
        for dist, a, (s1, t1), (s2, t2) in corner_terms(self.corners, x, y):
            e = (1 - a) * self.ero(s1, t1) + a * self.ero(s2, t2)
            p = [(1 - a) * u + a * v for u, v in zip(self.lip_params(s1, t1), self.lip_params(s2, t2))]
            terms.append((dist - e, *p))
        if not terms:
            return None
        d = big = m = min(tm[0] for tm in terms)
        for (s1, s2), (cx, cy) in PAIRS:
            if s1 in sides and s2 in sides:
                a, b = sides[s1], sides[s2]
                c = max(0.0, 1 - math.hypot(x - cx, y - cy) / 0.85)
                g = abs(a - b)
                d = min(d, min(a, b) - c * self.k * math.log1p(math.exp(-g / self.k)))
                big = min(big, min(a, b) - c * BELLY_K * math.log1p(math.exp(-g / BELLY_K)))
        ws = [math.exp(-(tm[0] - m) / 0.05) for tm in terms]
        s = sum(ws)
        return (d, big, *[sum(w * tm[i] for w, tm in zip(ws, terms)) / s for i in (1, 2, 3, 4)])

    def h(self, x, y):
        return gbase(x, y) + window(x, y) ** 0.4 * sum(c.h(x, y) for c in self.craters)

    def under(self, x, y):
        """(z of the underside, profile 0..1, q) below the worn edge."""
        e = self.edge(x, y)
        if e is None:
            return -1.1, 1.0, 1.0
        d, big, W, D, b, shelf = e
        d = d + (big - d) * max(0.0, min(1.0, d / 0.15))                                  # rounder further down
        q = max(0.0, min(1.0, d / W))
        b /= D
        if q < 0.05:                                                                      # the broken band
            ph = b * q / 0.05
        elif q < 0.1:                                                                     # the shelf
            ph = b + 0.012 * (q - 0.05) / 0.05
        else:                                                                             # the belly
            r = (q - 0.1) / 0.9
            ph = b + 0.012 + (1 - b - 0.012) * (1 - (1 - r) ** 2)
            rl = 0.38 + 0.1 * per2(x, y, 330, n=3)                                         # a ledge standing out
            ph -= shelf * 0.07 * math.exp(-((r - rl) / 0.07) ** 2) * (1 - r)
        facet = 0.09 * tri1((x + y) * 1.0 + 0.3 * per1(x - y, 310), 300, n=3) * 4 * ph * (1 - ph)
        z = self.h(x, y) - 0.002 - D * ph + facet
        s = max(0.0, min(1.0, (ph - 0.1) / 0.1, (0.97 - ph) / 0.06))                      # strata steps in the belly
        return z + (terrace(z) - z) * 0.6 * s, ph, q

    def inside(self, x, y):
        e = self.edge(x, y)
        return 1.0 if e is None else e[0]

    def col(self, x, y):
        c = crater_col(self.craters, x, y, ("gdL", "gd", "gdM", "gdD"))
        if c:
            return c
        if self.scrape and window(x, y) > 0.15:
            u = x * math.cos(self.scrape_a) + y * math.sin(self.scrape_a)
            if (u * 7) % 1 < 0.14:
                return "gdM"
        return "gdM" if per2(x, y, 13 + self.var, n=3) > 1.0 else "gd"


def ground(k, tile, ox, oy):
    O = Vector((ox, oy, 0))
    n = 48
    xs = [-0.5 + i / n for i in range(n + 1)]
    F = {(x, y): tile.inside(x, y) for y in xs for x in xs}
    U = {}

    def under(p):
        if p not in U:
            U[p] = tile.under(*p)
        return U[p]
    up, C = Vector((0, 0, 1)), Vector((0, 0, -0.6))
    for j in range(n):
        for i in range(n):
            a0, a1, b1, b0 = (xs[i], xs[j]), (xs[i + 1], xs[j]), (xs[i + 1], xs[j + 1]), (xs[i], xs[j + 1])
            for tr in ((a0, a1, b1), (a0, b1, b0)):
                if all(F[p] < 0 for p in tr):
                    continue
                pg = clip_f(list(tr), F) if any(F[p] < 0 for p in tr) else list(tr)
                if len(pg) < 3:
                    continue
                cx, cy = sum(p[0] for p in pg) / len(pg), sum(p[1] for p in pg) / len(pg)
                polyg(k, [Vector((p[0], p[1], tile.h(*p))) + O for p in pg], tile.col(cx, cy), up)   # the top
                if all(F[p] > 0.6 for p in tr) and tile.edge(cx, cy) is None:
                    continue
                us = [under(p) for p in pg]
                if min(u[1] for u in us) > 0.998:
                    continue                                                              # flat bottom: never seen
                pts = [Vector((p[0], p[1], u[0])) + O for p, u in zip(pg, us)]
                zc = sum(p.z for p in pts) / len(pts)
                out = Vector((cx + ox, cy + oy, zc)) - C - O
                nn = (pts[1] - pts[0]).cross(pts[2] - pts[0])
                nn = nn.normalized() if nn.length > 1e-12 else up
                if max(u[2] for u in us) < 0.05:
                    polyg(k, pts, "rkM", out)                                             # the broken band
                elif abs(nn.z) > 0.8:
                    polyg(k, pts, "rkK", out)                                             # shelf, underside
                else:
                    strata_faces(k, pts, out, darken=True)
    for cx, cy, rr, sd in tile.pebbles:
        if tile.inside(cx, cy) < rr + 0.06:
            continue
        r = rng(sd)
        c = Vector((cx, cy, tile.h(cx, cy))) + O
        pts = [c + Vector((math.cos(a) * rr, math.sin(a) * rr * r.uniform(0.7, 1.1), 0))
               for a in np.linspace(0, TAU, 5, endpoint=False)]
        top = c + Vector((0, 0, rr * 0.9))
        for a, b in zip(pts, pts[1:] + pts[:1]):
            tri(k, a, b, top, "gdL" if (a.y + b.y) / 2 > c.y else "gdM", (a + b) / 2 + Vector((0, 0, 0.02)) - c)
