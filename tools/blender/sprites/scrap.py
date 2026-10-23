"""Scrap for the scrap cage (ore_cage.cage with ore "scrap", module.storage_scrap): salvage piled on the heap's dark bed.
Plate offcuts, beam stubs, bent pipes, discs and a few painted panels, tumbled at random on the heap's surface; more
stood against the walls inside the bars, so the scrap shows through them. Seeded, so renders repeat."""
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
        L = math.hypot(u1 - u0, v1 - v0)
        rz = math.atan2(v1 - v0, u1 - u0)
        nu, nv = (v1 - v0) / L, -(u1 - u0) / L                             # outward
        for _ in range(int(L * 6)):
            t = rng.uniform(0.1, 0.9)
            u, v = u0 + (u1 - u0) * t - nu * 0.07, v0 + (v1 - v0) * t - nv * 0.07
            top = heap.h(u, v)
            if top < 0.3:
                continue
            piece(k, rng, u, v, rng.uniform(0.25, top - 0.04), rz=rz + rng.uniform(-0.25, 0.25), upright=True)


def floor(k, b, seed):
    """The empty cage: a few pieces left lying on its floor."""
    rng = np.random.default_rng(seed * 7 + 3)
    for _ in range(6):
        piece(k, rng, rng.uniform(b.u0 + 0.3, b.u1 - 0.3), rng.uniform(b.v0 + 0.3, b.v1 - 0.3), 0.2)
