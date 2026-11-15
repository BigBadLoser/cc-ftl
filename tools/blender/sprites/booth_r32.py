"""Booth look study round 32 (family `booth32`, palette sets bar22 + bar17 + bar9, preview only): round 31's M2 (eight
cushions, bone between them) with curved cushion tops. Each cushion is five segments along the curve. The outer ones
stop lower, so the top reads as an arch, and the middle ones stand a little prouder, so the face reads as rounded too.
No pillow strip: it showed as a dark line in round 31.

  n1 rounded corners only (outer segments 1 px lower)
  n2 a full arch (2 px, 1 px, flat middle)
  n3 n2 with a rounded foot as well, so each cushion is a capsule

All in px of the footprint's centre (u across, v deep, front +v toward the camera, z up)."""
from .barcounter_r10 import arcseg
from .barcounter_study import SEAT
from .booth_r29 import A0, A1, BACK, CU, CV, FP, ring, table
from .booth_r30 import base
from .research_kit import Bench

FACE = 27.5                                                                      # the backing's inner face
CORNERS = (1, 0, 0, 0, 1)
ARCH = (2, 1, 0, 1, 2)


def soft(k, n, gap, top, foot=(0, 0, 0, 0, 0), d=1.5, z0=SEAT, z1=BACK - 1):
    """n cushions round the arc, `gap` px apart. Segment j stops top[j] px under z1 and starts foot[j] px over z0; the
    taller a segment, the prouder it stands (up to 0.6 px), lit along its top."""
    m = len(top)
    hi = max(top)
    span = (A1 - A0) - n * gap / FACE
    da = span / n
    for i in range(n):
        ac = A0 + (i + 0.5) * (A1 - A0) / n
        for j in range(m):
            a = ac + (j - (m - 1) / 2) * da / m
            w = da / m * FACE * 1.15
            dj = d + (hi - top[j]) * 0.3
            r = FACE - dj / 2
            lo, up = z0 + foot[j], z1 - top[j]
            arcseg(k, CU, CV, a, w, r, dj, lo, up - 1, "x7Oxide")
            arcseg(k, CU, CV, a, w, r, dj, up - 1, up, "k2OxideL")


def booth(name, **kw):
    k = Bench(name, FP)
    base(k)
    ring(k, 28, 1, SEAT, BACK - 1, "x7Bone")
    soft(k, 8, 3, **kw)
    table(k)
    return k.build()


VARIANTS = {"n1": lambda: booth("booth_n1", top=CORNERS),
            "n2": lambda: booth("booth_n2", top=ARCH),
            "n3": lambda: booth("booth_n3", top=ARCH, foot=CORNERS)}


def jobs():
    return [(f"module.booth.{v}", FP, "prop", f) for v, f in VARIANTS.items()]
