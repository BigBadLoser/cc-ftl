"""Asteroid rock: ore veins through rock tiles (iron, ice, rare metals, energy crystals; rich and thin) and their crystals, glints and
nodules."""
import math

import numpy as np
from mathutils import Vector

from .rock_base import TAU, ZM, gbase, per2, quad, rng, tri


ORE_SEED = {"iron": 401, "ice": 433, "rare": 467, "crystal": 491}
ORE_WARP = {"iron": 0.28, "ice": 0.14, "rare": 0.16, "crystal": 0.2}
ORE_DIR = {"iron": (1, 2), "ice": (2, -1), "rare": (1, -1), "crystal": (1, 1)}   # long veins, joined across tiles
NETWORK = ("crystal",)             # ore kinds whose seams are a network over the field: tiles .e<open edges> (Ore._seams)
EDGE_AT = (0.11, -0.09)            # where a seam crosses an N/S edge (x) and an E/W edge (y)
EDGES = ((1, (EDGE_AT[0], -0.5), (0, 1)), (2, (0.5, EDGE_AT[1]), (-1, 0)), (4, (EDGE_AT[0], 0.5), (0, -1)),
         (8, (-0.5, EDGE_AT[1]), (1, 0)))


class Ore:
    """Veins through a rock tile: slanted sheets, level sets of a tile-periodic field plus height, so they run on across
    neighbouring ore tiles and show as streaks on the top and diagonal bands down the cliffs. Thin (mined) veins are
    narrower and every other sheet is gone."""
    def __init__(self, kind, rich, var=0):
        self.kind, self.rich, self.var = kind, rich, var
        self.seed = ORE_SEED[kind]
        self.w = (0.17 if rich else 0.09) if kind == "crystal" else (0.2 if rich else 0.09)

    def strength(self, x, y, z):
        """0 outside a vein, rising to 1 at its middle."""
        if self.kind == "crystal":
            return self._seam(x, y, z)
        a, b = ORE_DIR[self.kind]                                                         # whole cycles a tile:
        s = a * x + b * y + ORE_WARP[self.kind] * per2(x, y, self.seed, n=4) + 0.1 * per2(x * 2, y * 2, self.seed + 1, n=3) + 0.9 * z
        k = math.floor(s)
        if not self.rich and k % 2:
            return 0.0
        u = s - k
        return max(0.0, 1 - min(u, 1 - u) / (self.w / 2))

    def _seam(self, x, y, z):
        """Crystal seams. On the top: each variant's own short curved seams in random directions, swelling in the
        middle, pinching to nothing at both ends (inside the tile, so nothing has to join), with a side spur or two.
        Down the cliffs: the tile-periodic sheets, so the streaks run on across neighbouring cliffs."""
        if z < ZM * 0.85:
            a, b = ORE_DIR[self.kind]
            s = a * x + b * y + ORE_WARP[self.kind] * per2(x, y, self.seed, n=4) + 0.9 * z
            u = s - math.floor(s)
            if not self.rich and math.floor(s) % 2:
                return 0.0
            return max(0.0, 1 - min(u, 1 - u) / (self.w / 2))
        best = 0.0
        for pts, ts, wt in self._seams():
            d = pts - (x, y)
            ab = pts[1:] - pts[:-1]
            t = np.clip(-(d[:-1] * ab).sum(1) / np.maximum((ab * ab).sum(1), 1e-9), 0, 1)
            q = d[:-1] + ab * t[:, None]
            dist = np.sqrt((q * q).sum(1))
            i = int(dist.argmin())
            w = wt(ts[i] + (ts[i + 1] - ts[i]) * t[i])
            if w > 1e-3:
                best = max(best, 1 - dist[i] / (w / 2))
        return best

    def _seams(self):
        """[(points along a seam, their t in 0..1, width at t)], built once. var = the open edges (bits as the mask: 1 N
        = -y, 2 E = +x, 4 S = +y, 8 W = -x): a seam crosses each open edge at a fixed point (EDGE_AT, the same on both
        tiles of the edge) and runs in, square to the edge, to a hub inside the tile. One open edge: a seam that pinches
        out at the hub; none: bare rock. So the seams of a field form one network that never repeats as a grid."""
        if getattr(self, "_cache", None) is None:
            r = rng(self.seed + 13 * self.var + (0 if self.rich else 500))
            hub = np.array((r.uniform(-0.15, 0.15), r.uniform(-0.15, 0.15)))
            we = self.w * 0.8
            open_ = [e for e in EDGES if self.var & e[0]]
            out = []
            for bit, p0, inward in open_:
                p0, inward = np.array(p0), np.array(inward)
                p1 = p0 + inward * r.uniform(0.2, 0.32)
                ts = np.linspace(0, 1, 18)
                pts = np.array([(1 - t) ** 2 * p0 + 2 * (1 - t) * t * p1 + t * t * hub for t in ts])
                ph, dead = r.uniform(0, TAU), len(open_) == 1
                d = np.gradient(pts, axis=0)                                              # a wobble, 0 at both ends
                nrm = np.stack((-d[:, 1], d[:, 0]), 1) / np.maximum(np.linalg.norm(d, axis=1), 1e-9)[:, None]
                pts = pts + nrm * (0.035 * np.sin(np.pi * ts) * np.sin(9 * ts + ph))[:, None]
                wt = (lambda t, ph=ph, dead=dead: we * (1 + 0.7 * math.sin(math.pi * t) * (0.6 + 0.4 * math.sin(5 * t + ph)))
                      * ((1 - t) ** 0.6 if dead else 1.0))
                out.append((pts, ts, wt))
            if self.rich and len(open_) >= 2 and r.random() < 0.6:                       # a spur off the hub
                sa = r.uniform(0, TAU)
                ts = np.linspace(0, 1, 8)
                pts = np.array([hub + np.array((math.cos(sa), math.sin(sa))) * 0.16 * t for t in ts])
                out.append((pts, ts, lambda t: we * 0.7 * (1 - t) ** 0.7))
            self._cache = out
        return self._cache

    def col(self, n, cx, cy, zc):
        top = n.z > 0.6
        lit = per2(cx * 5, cy * 5, self.seed + 3, n=3) > 0.6
        if self.kind == "iron":
            return ("orL" if lit else "or") if top else ("orM" if (zc * 9) % 1 < 0.5 else "orD")
        if self.kind == "ice":
            return ("icL" if lit else "ic") if top else ("icM" if (zc * 9) % 1 < 0.6 else "icD")
        if self.kind == "crystal":
            core = self.strength(cx, cy, zc) > 0.6
            return ("ecM" if core or lit else "ecD") if top else ("ecM" if (zc * 9) % 1 < 0.4 else "ecD")
        return "rvM" if top else "rvD"

    def sites(self, tile, count):
        """Points on the tile's surface inside a vein (not on the foot), with the surface normal there."""
        r = rng(self.seed * 31 + tile.mask * 7 + tile.corners * 3 + (0 if self.rich else 1) + 1009 * self.var)
        out = []
        for _ in range(400):
            if len(out) >= count:
                break
            x, y = r.uniform(-0.44, 0.44), r.uniform(-0.44, 0.44)
            z = tile.h(x, y)
            if z - gbase(x, y) < 0.08 or self.strength(x, y, z) < 0.3:
                continue
            e = 0.01
            n = Vector((tile.h(x - e, y) - tile.h(x + e, y), tile.h(x, y - e) - tile.h(x, y + e), 2 * e)).normalized()
            out.append((Vector((x, y, z)), n, int(r.integers(0, 1 << 30))))
        return out


def frame(axis):
    a = axis.normalized()
    u = a.cross(Vector((0, 0, 1)) if abs(a.z) < 0.9 else Vector((1, 0, 0))).normalized()
    return a, u, a.cross(u)


def crystal(k, base, axis, L, r, cols, O):
    """A hexagonal prism with a pointed tip; the base sunk into the rock."""
    a, u, v = frame(axis)
    b = base - a * (L * 0.25)
    ring = [b + (u * math.cos(t) + v * math.sin(t)) * r for t in np.linspace(0, TAU, 6, endpoint=False)]
    ring2 = [p + a * (L * 0.72) for p in ring]
    tip = b + a * L
    c = b + a * (L * 0.5)
    for i in range(6):
        j = (i + 1) % 6
        quad(k, ring[i] + O, ring[j] + O, ring2[j] + O, ring2[i] + O, cols[i % 2], (ring[i] + ring[j]) / 2 - c)
        tri(k, ring2[i] + O, ring2[j] + O, tip + O, cols[2 + i % 2], (ring2[i] + ring2[j]) / 2 + a * 0.01 - c)


def lump(k, c, rr, sd, cols, O, sides=6, height=1.0):
    r = rng(sd)
    pts = [c + Vector((math.cos(t) * rr * r.uniform(0.7, 1.2), math.sin(t) * rr * r.uniform(0.7, 1.2), -rr * 0.3))
           for t in np.linspace(0, TAU, sides, endpoint=False)]
    top = c + Vector((r.uniform(-0.3, 0.3) * rr, r.uniform(-0.3, 0.3) * rr, rr * height))
    for a, b in zip(pts, pts[1:] + pts[:1]):
        tri(k, a + O, b + O, top + O, cols[0] if (a.x + b.x + a.y + b.y) > 2 * (c.x + c.y) else cols[1],
            (a + b) / 2 + Vector((0, 0, 0.02)) - c)


def ore_features(k, tile, O):
    ore = tile.ore
    if ore.kind == "ice":                                                                 # crystal clusters
        for p, n, sd in ore.sites(tile, 9 if ore.rich else 3):
            r = rng(sd)
            for _ in range(int(r.integers(3, 7) if ore.rich else r.integers(2, 4))):
                tilt = Vector((r.uniform(-1, 1), r.uniform(-1, 1), r.uniform(-1, 1))) * 0.45
                ax = (n * 0.75 + Vector((0, 0, 0.25)) + tilt).normalized()
                L = r.uniform(0.07, 0.17) * (1.0 if ore.rich else 0.6)
                off = Vector((r.uniform(-1, 1), r.uniform(-1, 1), 0)) * 0.02
                glow = "icG" if ore.rich else "icL"
                crystal(k, p + off, ax, L, L * 0.17, ("ic", "icL", glow, "icL"), O)
    elif ore.kind == "rare":                                                              # violet glints
        for p, n, sd in ore.sites(tile, 30 if ore.rich else 10):
            r = rng(sd)
            crystal(k, p, (n + Vector((r.uniform(-.4, .4), r.uniform(-.4, .4), 0.3))).normalized(),
                    r.uniform(0.018, 0.035), r.uniform(0.006, 0.01), ("rvM", "rvG", "rvG", "rvG"), O)
    elif ore.kind == "crystal":                                                           # long teal clusters
        picked = []                                                                       # spaced along the seams
        for p, n, sd in ore.sites(tile, 80):
            if len(picked) < (6 if ore.rich else 3) and all((p - q).length > 0.13 for q, _, _ in picked):
                picked.append((p, n, sd))
        for p, n, sd in picked:
            r = rng(sd)
            for _ in range(int(r.integers(3, 6) if ore.rich else r.integers(2, 4))):
                tilt = Vector((r.uniform(-1, 1), r.uniform(-1, 1), r.uniform(-1, 1))) * 0.4
                ax = (n * 0.7 + Vector((0, 0, 0.35)) + tilt).normalized()
                L = r.uniform(0.12, 0.26) * (1.0 if ore.rich else 0.6)
                off = Vector((r.uniform(-1, 1), r.uniform(-1, 1), 0)) * 0.025
                crystal(k, p + off, ax, L, L * 0.14, ("ecM", "ecL", "ecW" if L > 0.23 else "ecG", "ecL"), O)
        for p, n, sd in ore.sites(tile, 16 if ore.rich else 6):                           # and glints between
            r = rng(sd + 1)
            crystal(k, p, (n + Vector((r.uniform(-.4, .4), r.uniform(-.4, .4), 0.3))).normalized(),
                    r.uniform(0.02, 0.04), r.uniform(0.007, 0.011), ("ecM", "ecL", "ecG", "ecM"), O)
    elif ore.rich:                                                                        # rusty nodules
        for p, n, sd in ore.sites(tile, 6):
            lump(k, p, rng(sd).uniform(0.025, 0.045), sd, ("orL", "orM"), O, height=0.8)
