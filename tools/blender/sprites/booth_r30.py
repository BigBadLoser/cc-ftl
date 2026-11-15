"""Booth look study round 30 (family `booth30`, palette sets bar22 + bar17 + bar9, preview only; seat 15 px, table top
24 px, backs 28 px): E1 (round 28, the half-round booth round a round pedestal table) with its back as separate vertical
cushions. E1 cut thin seams into one pad and they broke up on the curve; here each cushion is its own block standing
proud of a backing, with a gap of 2 px or more between neighbours, so the separation reads as a gap, not a line.

  k1 ten cushions over a dark oxide backing, each lit along its top
  k2 eight cushions with bone between them (the shell shows through), their tops stepped in to read rounded
  k3 six wide cushions over gunmetal, and the seat split into six pads to match

All in px of the footprint's centre (u across, v deep, front +v toward the camera, z up)."""
import math

from .barcounter_r10 import arcseg
from .barcounter_study import SEAT
from .booth_r29 import A0, A1, BACK, CU, CV, FP, ring, table
from .research_kit import Bench

RC, DC = 26, 3                                                                  # cushions: centre radius, depth (24.5..27.5)


def base(k, seat=True):
    """E1's kick, seat and shell, the shell set back so a backing fits between it and the cushions."""
    ring(k, 20, 10, 0, 3, "r9Char")
    ring(k, 21, 12, 3, SEAT - 3, "x7Bone")
    if seat:
        ring(k, 21, 12, SEAT - 3, SEAT - 1, "x7Oxide")
        ring(k, 21, 12, SEAT - 1, SEAT, "k2OxideL")
    ring(k, 30, 3, 0, BACK, "x7Bone")                                             # inner face at 28.5
    ring(k, 30, 4, BACK, BACK + 2, "x7Gun")


def cushions(k, n, gap, col="x7Oxide", lit="k2OxideL", z0=SEAT, z1=BACK - 1, step=False, r=RC, d=DC):
    """n vertical cushions round the arc, `gap` px apart at their face. Each is a flat block (a chord), lit on top; with
    `step` its top 2 px are narrower, so it reads rounded."""
    span = (A1 - A0) - n * gap / (r - d / 2)
    da = span / n
    for i in range(n):
        a = A0 + (i + 0.5) * (A1 - A0) / n
        w = da * (r - d / 2)                                                         # the chord at the cushion's face
        top = z1 - 2 if step else z1 - 1
        arcseg(k, CU, CV, a, w, r, d, z0, top, col)
        if step:
            arcseg(k, CU, CV, a, w - 2, r, d - 0.5, top, z1, lit)
        else:
            arcseg(k, CU, CV, a, w, r, d, top, z1, lit)


def k1():
    k = Bench("booth_k1", FP)
    base(k)
    ring(k, 28, 1, SEAT, BACK - 1, "x7OxideD")                                      # dark backing, 27.5..28.5
    cushions(k, 10, 2.5)
    table(k)
    return k.build()


def k2():
    k = Bench("booth_k2", FP)
    base(k)
    ring(k, 28, 1, SEAT, BACK - 1, "x7Bone")                                        # bone between the cushions
    cushions(k, 8, 3, step=True)
    table(k)
    return k.build()


def k3():
    k = Bench("booth_k3", FP)
    base(k, seat=False)
    ring(k, 21, 12, SEAT - 3, SEAT - 2, "x7Gun")                                    # the seat pads' tray
    ring(k, 28, 1, SEAT - 2, BACK - 1, "x7Gun")
    cushions(k, 6, 3)
    cushions(k, 6, 3, z0=SEAT - 2, z1=SEAT, r=21, d=11)                             # seat pads, split to match
    table(k)
    return k.build()


VARIANTS = {"k1": k1, "k2": k2, "k3": k3}


def jobs():
    return [(f"module.booth.{v}", FP, "prop", f) for v, f in VARIANTS.items()]
