"""Booth look study round 29 (family `booth29`, palette sets bar22 + bar17 + bar9, preview only; seat 15 px, table top
24 px, backs 28 px): three refinements of E1 (round 28), the half-round booth round a round pedestal table. E1's
vertical channels broke into ragged seams on the curve, so none of these cut vertical seams into it: the arc is drawn
in more, overlapping segments, and any tufting runs along the curve.

  f1 plain: one continuous oxide back pad with a lit top roll
  f2 rolled: the back pad as two stacked rolls running round the curve, a dark seam between them
  f3 posts: f1 with square bone posts capping the arc's two ends and a gunmetal band at the foot of the shell

All in px of the footprint's centre (u across, v deep, front +v toward the camera, z up)."""
import math

from .barcounter_r10 import arcseg
from .barcounter_r3 import cyl
from .barcounter_study import SEAT, TOP
from .bunk_study import _px
from .research_kit import Bench

FP = (2, 2)
BACK = SEAT + 13
CU, CV, N = 0, -2, 28
A0, A1 = math.radians(180), math.radians(360)


def ring(k, r, d, z0, z1, col, wk=1.25):
    """A half ring at radius r, d px across, from z0 to z1, in N overlapping segments."""
    w = math.pi * r / N * wk
    for i in range(N):
        arcseg(k, CU, CV, A0 + (A1 - A0) * (i + 0.5) / N, w, r, d, z0, z1, col)


def shell(k):
    ring(k, 20, 10, 0, 3, "r9Char")
    ring(k, 21, 12, 3, SEAT - 3, "x7Bone")
    ring(k, 21, 12, SEAT - 3, SEAT - 1, "x7Oxide")
    ring(k, 21, 12, SEAT - 1, SEAT, "k2OxideL")
    ring(k, 29.5, 3, 0, BACK, "x7Bone")
    ring(k, 29.5, 4, BACK, BACK + 2, "x7Gun")


def table(k):
    cyl(k, CU, CV, 0, 1, 6, "x7Gun", sides=18)
    cyl(k, CU, CV, 1, TOP - 3, 2, "r9Grey", sides=10)
    cyl(k, CU, CV, TOP - 3, TOP - 1, 11, "x7Black", sides=24)
    cyl(k, CU, CV, TOP - 1, TOP, 10.5, "x7Gun", sides=24)


def f1():
    k = Bench("booth_f1", FP)
    shell(k)
    ring(k, 27, 2, SEAT, BACK - 3, "x7Oxide")
    ring(k, 27, 2, BACK - 3, BACK - 1, "k2OxideL")
    table(k)
    return k.build()


def f2():
    k = Bench("booth_f2", FP)
    shell(k)
    ring(k, 27.5, 1, SEAT, BACK - 1, "x7OxideD")                                    # the seam ground
    mid = (SEAT + BACK - 1) / 2
    for z0, z1 in ((SEAT, mid - 0.5), (mid + 0.5, BACK - 1)):
        ring(k, 26.5, 2, z0, z1 - 1, "x7Oxide")
        ring(k, 26.5, 2, z1 - 1, z1, "k2OxideL")
    table(k)
    return k.build()


def f3():
    k = Bench("booth_f3", FP)
    shell(k)
    ring(k, 29.5, 3.6, 3, 5, "x7Gun")                                               # band at the shell's foot
    ring(k, 27, 2, SEAT, BACK - 3, "x7Oxide")
    ring(k, 27, 2, BACK - 3, BACK - 1, "k2OxideL")
    for s in (-1, 1):                                                                # posts at the arc's ends
        u = CU + s * 29.5
        _px(k, u - 2.5, u + 2.5, CV - 1, CV + 4, 0, BACK + 2, "x7Bone")
        _px(k, u - 3, u + 3, CV - 1.5, CV + 4.5, BACK + 2, BACK + 3, "x7Gun")
    table(k)
    return k.build()


VARIANTS = {"f1": f1, "f2": f2, "f3": f3}


def jobs():
    return [(f"module.booth.{v}", FP, "prop", f) for v, f in VARIANTS.items()]
