"""The tip bin's fine plates and its wear, done the mining pod's way: the body's plates are cut into small faces, then
each face's colour is blended by where it lies (mining_pod.wear), so the wear reads as soft gradients, not patches.

Outside: rust run-off streaking down from the rim, the asteroid's dust gathered low and in broad blotches. Inside: ore
grime packed low."""
import math

import numpy as np
from mathutils import Vector

from . import ore_cage as C

GRID = 0.06


def _clip(poly, conv):
    """poly cut to the convex ccw polygon conv, in 2D."""
    for i in range(len(conv)):
        a, b = conv[i], conv[(i + 1) % len(conv)]
        out = []
        for j in range(len(poly)):
            p, q = poly[j], poly[(j + 1) % len(poly)]
            dp = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])
            dq = (b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0])
            if dp >= 0:
                out.append(p)
            if (dp >= 0) != (dq >= 0):
                t = dp / (dp - dq)
                out.append((p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t))
        poly = out
        if len(poly) < 3:
            return []
    return poly


def plate(k, pr, u, col, flip=False):
    """The convex ccw profile pr (v, z) as a flat plate at u, in GRID cells; it faces +u (or -u with flip)."""
    vs, zs = [p[0] for p in pr], [p[1] for p in pr]
    nv, nz = math.ceil((max(vs) - min(vs)) / GRID), math.ceil((max(zs) - min(zs)) / GRID)
    for i in range(nv):
        for j in range(nz):
            v0, z0 = min(vs) + i * GRID, min(zs) + j * GRID
            cell = _clip([(v0, z0), (v0 + GRID, z0), (v0 + GRID, z0 + GRID), (v0, z0 + GRID)], pr)
            if cell:
                pts = [(u, v, z) for v, z in cell]
                C._poly(k, pts[::-1] if flip else pts, col)


def band(k, q, col):
    """The quad q (4 local points, wound to face out) in about GRID cells."""
    a, b, c, d = (Vector(p) for p in q)
    n1 = max(1, math.ceil((b - a).length / GRID))
    n2 = max(1, math.ceil((d - a).length / GRID))

    def at(s, t):
        return a.lerp(b, s).lerp(d.lerp(c, s), t)
    for i in range(n1):
        for j in range(n2):
            C._poly(k, [tuple(at(i / n1, j / n2)), tuple(at((i + 1) / n1, j / n2)), tuple(at((i + 1) / n1, (j + 1) / n2)),
                        tuple(at(i / n1, (j + 1) / n2))], col)


def local(k, p):
    """A Blender-space vertex back in the module's local (u, v, z)."""
    x, y = p[0] - k.off[0], -p[1] - k.off[1]
    u, v = ((x, y), (y, -x), (-x, -y), (-y, x))[k.rot]
    return Vector((u, v, p[2]))


def _s(x):
    x = min(1.0, max(0.0, x))
    return x * x * (3 - 2 * x)


def grime(k, n0, n1, centre, top_z, seed=5, low_z=0.85, run_k=0.9, dust_k=1.0, run_col="rust"):
    """Wear on faces n0 .. n1: centre (local) is a point inside the bin, top_z(v) its rim height. low_z: dust gathers
    below it; run_k, dust_k: how strong the run-off and the dust are."""
    from lib import palette
    rust, dust, ore = (Vector(palette.linear(c)) for c in (run_col, "gdD", "rkD"))
    rng = np.random.default_rng(seed)
    streaks = [(rng.uniform(0, 1), rng.uniform(0.3, 0.8), rng.uniform(0.02, 0.05)) for _ in range(18)]
    cx, cy = centre.x, centre.y
    for i in range(n0, n1):
        idx, col, own, glow = k.m.f[i]
        if any(own):
            continue
        P = [local(k, k.m.v[j]) for j in idx]
        c = sum(P, Vector()) / len(P)
        n = Vector()
        for j, a in enumerate(P):
            b = P[(j + 1) % len(P)]
            n += Vector(((a.y - b.y) * (a.z + b.z), (a.z - b.z) * (a.x + b.x), (a.x - b.x) * (a.y + b.y)))
        below = top_z(c.y) - c.z
        blot = 0.5 + 0.5 * math.sin(4.1 * c.x + 1.3) * math.sin(3.3 * c.y + 0.4) * math.cos(2.9 * c.z - 0.8)
        col = Vector(col)
        n = -n                                                              # stored winding is mirrored (core.G, flip)
        if n.dot(c - centre) < 0 and n.z < 0.9:                              # inside walls
            g = min(0.85, 0.8 * _s((0.85 - c.z) / 0.45) + 0.3 * _s((blot - 0.4) / 0.4))
            col = col.lerp(ore, g)
        else:
            t = (math.atan2(c.y - cy, c.x - cx) / math.tau) % 1
            run = sum(math.exp(-(((t - st + 0.5) % 1 - 0.5) * 6.0 / sw) ** 2) * 0.5 ** (max(0.0, below) / L)
                      for st, L, sw in streaks)
            run *= 1 - _s((abs(n.normalized().z) - 0.5) / 0.3)                # run-off only on upright faces
            low = _s((low_z - c.z) / (low_z * 0.6))
            col = col.lerp(rust, min(0.8, run_k * run))
            col = col.lerp(dust, dust_k * min(0.8, 0.7 * low + 0.4 * _s((blot - 0.4) / 0.4)))
        k.m.f[i] = (idx, tuple(col), own, glow)
