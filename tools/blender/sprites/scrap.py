"""Scrap for the scrap cage (ore_cage.cage with ore "scrap", module.storage_scrap): salvage piled on the heap's dark bed.
Plate offcuts, beam stubs, bent pipes, discs and a few painted panels, tumbled at random on the heap's surface, and
packed flat against the walls inside the bars (plates on edge, pipe and beam ends, discs), so the sides read like the
top. Seeded, so renders repeat."""
import math

import numpy as np
from mathutils import Vector

from .steelkit import tube

METAL = ("steel", "steelL", "steelD", "rust", "rustD", "plate", "steel", "rust")
PAINT = ("hivis", "c4T3", "navy", "gm", "medWhite")


def _col(rng):
    return PAINT[rng.integers(len(PAINT))] if rng.random() < 0.18 else METAL[rng.integers(len(METAL))]


def piece(k, rng, u, v, z, rz=None, upright=False):
    """One piece of scrap centred at (u, v, z): a plate, a beam stub, a pipe or a disc."""
    rz = rng.uniform(0, math.pi) if rz is None else rz
    kind = rng.choice(4, p=(0.38, 0.22, 0.28, 0.12))
    col = _col(rng)
    if kind == 0:                                                           # plate offcut, tumbled
        L, W = rng.uniform(0.14, 0.3), rng.uniform(0.08, 0.2)
        rx = rng.uniform(1.0, 1.4) if upright else rng.uniform(-0.6, 0.6)
        k.box(u, v, z - 0.01, L, W, 0.022, col, top=col, rz=rz, rx=rx)
    elif kind == 1:                                                         # beam stub: an I, end on or lying
        L = rng.uniform(0.18, 0.34)
        rx = rng.uniform(-0.5, 0.5)
        k.box(u, v, z - 0.04, L, 0.07, 0.016, col, rz=rz, rx=rx)
        k.box(u, v, z - 0.04, L, 0.016, 0.07, col, top=col, rz=rz, rx=rx)
    elif kind == 2:                                                         # pipe, maybe bent
        L, r = rng.uniform(0.16, 0.32), rng.uniform(0.02, 0.035)
        a = Vector((math.cos(rz), math.sin(rz), rng.uniform(-0.35, 0.5) if not upright else rng.uniform(1.0, 2.0)))
        a.normalize()
        p0 = Vector((u, v, z)) - a * L / 2
        mid = Vector((u, v, z))
        bend = Vector((-a.y, a.x, 0)) * rng.uniform(-0.06, 0.06) if rng.random() < 0.5 else Vector()
        tube(k, p0, mid + bend, r, col, sides=6, cap="dark")
        tube(k, mid + bend, mid + a * L / 2, r, col, sides=6, cap="dark")
    else:                                                                   # disc: a flange or a gear blank
        r = rng.uniform(0.05, 0.09)
        k.cyl(u, v, z - 0.02, r, 0.03, col, top=col, sides=10)
        k.cyl(u, v, z + 0.008, r * 0.35, 0.012, "dark", sides=8)


def pile(k, heap, seed):
    """Scrap over the heap's bed and stood against its walls (heap: ore_cage.Heap, already built)."""
    rng = np.random.default_rng(seed * 7 + 1)
    a, bv, cv = heap.a, heap.bv, heap.cv
    m = 0.13                                                                # keep pieces inside the bars
    for _ in range(int(4 * a * bv * 30)):
        u = rng.uniform(-a + m, a - m)
        v = cv + rng.uniform(-bv + m, bv - m)
        piece(k, rng, u, v, heap.h(u, v) + rng.uniform(-0.03, 0.03))
    for (u0, v0), (u1, v1) in (((-a, cv - bv), (a, cv - bv)), ((a, cv - bv), (a, cv + bv)),
                               ((a, cv + bv), (-a, cv + bv)), ((-a, cv + bv), (-a, cv - bv))):
        side(k, rng, heap, (u0, v0), (u1, v1))


def side(k, rng, heap, p, q, pitch=0.11):
    """Scrap packed flat against the wall p -> q (ccw, at the heap's edge) up to the heap's surface, facing out through
    the bars: plates stood on edge, pipe and beam ends, discs."""
    L = math.dist(p, q)
    t_ = Vector(((q[0] - p[0]) / L, (q[1] - p[1]) / L, 0))
    n = Vector((t_.y, -t_.x, 0))                                            # outward
    rz = math.atan2(t_.y, t_.x)
    for i in range(int(L / pitch)):
        for j in range(8):
            s = (i + 0.5 + rng.uniform(-0.3, 0.3)) * pitch
            u, v = p[0] + t_.x * s, p[1] + t_.y * s
            z = 0.3 + (j + rng.uniform(0, 0.8)) * pitch * 0.85
            if z > heap.h(u, v) - 0.05:
                break
            c = Vector((u, v, z)) + n * 0.035                             # between the bed and the bars
            col = _col(rng)
            kind = rng.choice(4, p=(0.5, 0.2, 0.15, 0.15))
            if kind == 0:                                                   # a plate stood against the bars
                k.box(c.x, c.y, z - 0.06, rng.uniform(0.1, 0.22), 0.02, rng.uniform(0.09, 0.17), col, top=col,
                      rz=rz + rng.uniform(-0.25, 0.25), rx=rng.uniform(-0.2, 0.2))
            elif kind == 1:                                                 # a pipe end
                r = rng.uniform(0.022, 0.04)
                tube(k, c - n * 0.06, c + n * 0.02, r, col, sides=8, cap="dark")
            elif kind == 2:                                                 # a disc face
                r = rng.uniform(0.045, 0.08)
                tube(k, c - n * 0.02, c + n * 0.015, r, col, sides=10)
                tube(k, c + n * 0.015, c + n * 0.02, r * 0.35, "dark", sides=8)
            else:                                                           # a beam end, the I toward the bars
                w = rng.uniform(0.06, 0.09)
                k.box(c.x - n.x * 0.03, c.y - n.y * 0.03, z - w / 2, 0.016, 0.08, w, col, rz=rz + math.pi / 2)
                for dz in (-w / 2, w / 2 - 0.016):
                    k.box(c.x - n.x * 0.03, c.y - n.y * 0.03, z + dz, w, 0.08, 0.016, col, top=col, rz=rz + math.pi / 2)


def floor(k, b, seed):
    """The empty cage: a few pieces left lying on its floor."""
    rng = np.random.default_rng(seed * 7 + 3)
    for _ in range(6):
        piece(k, rng, rng.uniform(b.u0 + 0.3, b.u1 - 0.3), rng.uniform(b.v0 + 0.3, b.v1 - 0.3), 0.2)


SIZES = {"module.storage_scrap": (2, 2), "module.storage_scrap_large": (2, 3)}


def jobs():
    """Family `storage_scrap`, per size and rotation: <asset>[.r<r>].<fill> (empty, fill1, fill2, full); the plain <asset>
    is r0 at fill2."""
    from . import ore_cage as C
    out = []
    for name, fp in SIZES.items():
        for r in range(4):
            f_ = fp if r % 2 == 0 else fp[::-1]
            sfx = "" if r == 0 else f".r{r}"
            out += [(f"{name}{sfx}.{fill}", f_, "prop", lambda fp=fp, fill=fill, r=r: C.cage(fp, fill, r, "scrap", drop=1))
                    for fill in C.FILLS]
        out.append((name, fp, "prop", lambda fp=fp: C.cage(fp, "fill2", 0, "scrap", drop=1)))
    return out

