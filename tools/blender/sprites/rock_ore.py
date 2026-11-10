"""Asteroid rock: ore veins through rock tiles (iron, ice, rare metals, energy crystals; rich and thin) and their crystals, glints and
nodules."""
import math

import numpy as np
from mathutils import Vector

from .rock_base import TAU, gbase, per2, quad, rng, tri


ORE_SEED = {"iron": 401, "ice": 433, "rare": 467, "crystal": 491}
ORE_WARP = {"iron": 0.28, "ice": 0.14, "rare": 0.16, "crystal": 0.2}
ORE_DIR = {"iron": (1, 2), "ice": (2, -1), "rare": (1, -1), "crystal": (2, 1)}   # long veins, joined across tiles


class Ore:
    """Veins through a rock tile: slanted sheets, level sets of a tile-periodic field plus height, so they run on across
    neighbouring ore tiles and show as streaks on the top and diagonal bands down the cliffs. Thin (mined) veins are
    narrower and every other sheet is gone."""
    def __init__(self, kind, rich):
        self.kind, self.rich = kind, rich
        self.seed = ORE_SEED[kind]
        self.w = (0.26 if rich else 0.11) if kind == "crystal" else (0.2 if rich else 0.09)

    def strength(self, x, y, z):
        """0 outside a vein, rising to 1 at its middle."""
        a, b = ORE_DIR[self.kind]                                                         # whole cycles a tile:
        s = a * x + b * y + ORE_WARP[self.kind] * per2(x, y, self.seed, n=4) + 0.1 * per2(x * 2, y * 2, self.seed + 1, n=3) + 0.9 * z
        k = math.floor(s)
        if not self.rich and k % 2:
            return 0.0
        u = s - k
        return max(0.0, 1 - min(u, 1 - u) / (self.w / 2))

    def col(self, n, cx, cy, zc):
        top = n.z > 0.6
        lit = per2(cx * 5, cy * 5, self.seed + 3, n=3) > 0.6
        if self.kind == "iron":
            return ("orL" if lit else "or") if top else ("orM" if (zc * 9) % 1 < 0.5 else "orD")
        if self.kind == "ice":
            return ("icL" if lit else "ic") if top else ("icM" if (zc * 9) % 1 < 0.6 else "icD")
        if self.kind == "crystal":
            return ("ecL" if lit else "ecM") if top else ("ecM" if (zc * 9) % 1 < 0.4 else "ecD")
        return "rvM" if top else "rvD"

    def sites(self, tile, count):
        """Points on the tile's surface inside a vein (not on the foot), with the surface normal there."""
        r = rng(self.seed * 31 + tile.mask * 7 + tile.corners * 3 + (0 if self.rich else 1))
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


STYLE = __import__("os").environ.get("CRYSTAL_STYLE", "a")       # preview only: a = teal bodies, b = glowing cores


def spar(k, base, axis, L, r, O, glow, white):
    """An energy crystal for the rock tiles: a wide hexagonal prism (teal, the light shades it) whose upper part glows
    (glow), with a pale point (white) on the big ones."""
    a, u, v = frame(axis)
    b = base - a * (L * 0.2)
    rings = [[b + a * (L * f) + (u * math.cos(t) + v * math.sin(t)) * r * w for t in np.linspace(0, TAU, 6, endpoint=False)]
             for f, w in ((0.0, 1.0), (glow, 1.0), (0.78, 0.92))]
    tip = b + a * L
    c = b + a * (L * 0.5)
    body = {"a": ("ecM", "ecL"), "b": ("ecM", "ecM"), "c": ("ecD", "ecL")}[STYLE]
    for lo, hi, cols in ((rings[0], rings[1], body), (rings[1], rings[2], ("ecG", "ecG"))):
        for i in range(6):
            j = (i + 1) % 6
            quad(k, lo[i] + O, lo[j] + O, hi[j] + O, hi[i] + O, cols[i % 2], (lo[i] + lo[j]) / 2 - c)
    for i in range(6):
        j = (i + 1) % 6
        p, q = rings[2][i], rings[2][j]
        tri(k, p + O, q + O, tip + O, "ecW" if white else "ecG", (p + q) / 2 + a * 0.01 - c)


def crystal_clusters(k, tile, ore, O):
    """A few big clusters on dark nodules, spaced apart so each reads on its own: a tall middle crystal and 2-4 shorter
    ones fanning out of it. Thin veins keep one or two small ones."""
    want, gap = (4, 0.24) if ore.rich else (2, 0.3)
    picked = []
    for p, n, sd in ore.sites(tile, 60):
        if len(picked) < want and all((p - q).length > gap for q, _, _ in picked):
            picked.append((p, n, sd))
    glow = {"a": 0.62, "b": 0.32, "c": 0.66}[STYLE]
    tall, thin, fan = (1.45, 0.13, (0.3, 0.55)) if STYLE == "c" else (1.0, 0.17, (0.45, 0.8))
    for p, n, sd in picked:
        r = rng(sd)
        up = (n * 0.3 + Vector((0, 0, 0.7))).normalized() if STYLE == "c" else (n * 0.5 + Vector((0, 0, 0.5))).normalized()
        lump(k, p, (0.07 if ore.rich else 0.05) * (1.35 if STYLE == "c" else 1), sd, ("rkK", "rkK" if STYLE == "c" else "ecD"), O,
             height=0.45)
        H = (r.uniform(0.26, 0.34) if ore.rich else r.uniform(0.15, 0.2)) * tall
        spar(k, p, up, H, H * thin, O, glow, ore.rich)
        m = (int(r.integers(2, 4)) if STYLE == "c" else int(r.integers(2, 5))) if ore.rich else 2
        a0 = r.uniform(0, TAU)
        for i in range(m):
            t = a0 + i * TAU / m + r.uniform(-0.3, 0.3)
            side = Vector((math.cos(t), math.sin(t), 0))
            ax = (up + side * r.uniform(*fan)).normalized()
            L = H * r.uniform(0.5, 0.75)
            spar(k, p + side * 0.03, ax, L, L * (thin + 0.02), O, glow, False)


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
    elif ore.kind == "crystal":                                                           # big teal clusters
        crystal_clusters(k, tile, ore, O)
    elif ore.rich:                                                                        # rusty nodules
        for p, n, sd in ore.sites(tile, 6):
            lump(k, p, rng(sd).uniform(0.025, 0.045), sd, ("orL", "orM"), O, height=0.8)
