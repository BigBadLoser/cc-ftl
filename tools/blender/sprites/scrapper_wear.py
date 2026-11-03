"""The scrapper's wear, after the tip bin's (tip_bin_wear): the chosen faces are cut into small cells, then each cell's
colour is blended by where it lies, so the wear reads as soft gradients, not patches. Rust runs down the upright faces
from their top edges in streaks, grime gathers low and in broad, soft blotches."""
import math

import numpy as np
from mathutils import Vector

from . import core
from .tip_bin_wear import GRID, _clip, _s


def _newell(P):
    n = Vector()
    for j, a in enumerate(P):
        b = P[(j + 1) % len(P)]
        n += Vector(((a.y - b.y) * (a.z + b.z), (a.z - b.z) * (a.x + b.x), (a.x - b.x) * (a.y + b.y)))
    return n


def _convex(q):
    s = 0
    for j in range(len(q)):
        a, b, c = q[j - 2], q[j - 1], q[j]
        cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])
        if abs(cr) > 1e-9:
            if s and (cr > 0) != (s > 0):
                return False
            s = cr
    return True


def fine(m, names, grid=GRID):
    """Cut every face of mesh m whose colour is one of the palette names into about grid-sized cells (convex faces
    only; others are left whole). The cells keep the face's winding and colours."""
    want = {core.lin(c) for c in names}
    old_v, old_f = m.v, m.f
    m.v, m.f = [], []
    for idx, col, own, glow in old_f:
        P = [Vector(old_v[i]) for i in idx]
        n = _newell(P)
        if tuple(col) not in want or n.length < 1e-9:
            m.v += [tuple(p) for p in P]
            m.f.append((list(range(len(m.v) - len(P), len(m.v))), col, own, glow))
            continue
        n.normalize()
        u = (P[1] - P[0]).normalized()
        v = n.cross(u)
        q = [((p - P[0]).dot(u), (p - P[0]).dot(v)) for p in P]
        cells = []
        if _convex(q):
            us, vs = [a for a, _ in q], [b for _, b in q]
            nu, nv = max(1, math.ceil((max(us) - min(us)) / grid)), max(1, math.ceil((max(vs) - min(vs)) / grid))
            gu, gv = (max(us) - min(us)) / nu, (max(vs) - min(vs)) / nv
            for i in range(nu):
                for j in range(nv):
                    a0, b0 = min(us) + i * gu, min(vs) + j * gv
                    c = _clip([(a0, b0), (a0 + gu, b0), (a0 + gu, b0 + gv), (a0, b0 + gv)], q)
                    if len(c) >= 3:
                        cells.append(c)
        if not cells:
            cells = [q]
        for c in cells:
            base = len(m.v)
            m.v += [tuple(P[0] + u * a + v * b) for a, b in c]
            m.f.append((list(range(base, base + len(c))), col, own, glow))


def wear(b, names, top_z, seed=7, run_k=0.7, dust_k=0.7, low_z=0.35, run_col="rust", dust_col="grime", streaks=26):
    """Wear on b's faces whose colour is one of the palette names. top_z(L, D): the height of the top edge above a point
    (where run-off starts); low_z: grime gathers below it; run_k, dust_k: how strong the run-off and grime are."""
    want = {core.lin(c) for c in names}
    rust, dust = Vector(core.lin(run_col)), Vector(core.lin(dust_col))
    rng = np.random.default_rng(seed)
    runs = [(rng.uniform(0, 1), rng.uniform(0.15, 0.5), rng.uniform(0.006, 0.02)) for _ in range(streaks)]
    O = Vector(b.P(0, 0, 0))
    eL, eD = Vector(b.P(1, 0, 0)) - O, Vector(b.P(0, 1, 0)) - O
    det = eL.x * eD.y - eL.y * eD.x

    def local(p):                                                       # Blender space -> (L, D, z)
        x, y = p[0] - O.x, -p[1] - O.y
        return Vector(((x * eD.y - y * eD.x) / det, (eL.x * y - eL.y * x) / det, p[2]))
    m = b.m
    for i, (idx, col, own, glow) in enumerate(m.f):
        if tuple(col) not in want:
            continue
        P = [local(m.v[j]) for j in idx]
        c = sum(P, Vector()) / len(P)
        n = _newell(P)
        if n.length < 1e-9:
            continue
        n.normalize()
        up = 1 - _s((abs(n.z) - 0.5) / 0.3)                             # 1 on upright faces, 0 on flat ones
        t = (c.x + c.y) / 6.0 if abs(n.y) > abs(n.x) else (c.y + 4.0 + c.x) / 6.0   # along the face, for the streaks
        below = max(0.0, top_z(c.x, c.y) - c.z)
        run = sum(math.exp(-(((t - st + 0.5) % 1 - 0.5) / sw) ** 2) * 0.5 ** (below / ln) for st, ln, sw in runs)
        blot = 0.5 + 0.5 * math.sin(4.1 * c.x + 1.3) * math.sin(5.3 * c.y + 0.4) * math.cos(3.9 * c.z - 0.8)
        low = _s((low_z - c.z) / (low_z * 0.8))
        col = Vector(col)
        col = col.lerp(rust, min(0.75, run_k * run * up))
        col = col.lerp(dust, dust_k * min(0.7, 0.7 * low + 0.35 * _s((blot - 0.45) / 0.4)))
        m.f[i] = (idx, tuple(col), own, glow)
