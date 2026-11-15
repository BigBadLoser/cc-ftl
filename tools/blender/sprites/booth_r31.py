"""Booth look study round 31 (family `booth31`, palette sets bar22 + bar17 + bar9, preview only): K1 and K2 (round 30)
with softer, flatter cushions. Round 30's cushions were 3 px deep flat chords, so they stood far off the backing and read
as blocks. Here each cushion is 1.5 px deep and follows the curve (three short segments, not one chord), with a 1 px
pillow in its middle (narrower and shorter), so it reads padded rather than boxy.

  m1 K1: ten cushions over the dark oxide backing
  m2 K2: eight cushions with bone between them
  m3 K2 with tapered cushions: the pillow runs the full height and the top and foot of each cushion step in

All in px of the footprint's centre (u across, v deep, front +v toward the camera, z up)."""
from .barcounter_r10 import arcseg
from .barcounter_study import SEAT
from .booth_r29 import A0, A1, BACK, CU, CV, FP, ring, table
from .booth_r30 import base
from .research_kit import Bench

FACE = 27.5                                                                      # the backing's inner face


def pillows(k, n, gap, d=1.5, z0=SEAT, z1=BACK - 1, taper=False):
    """n soft cushions round the arc, `gap` px apart, `d` px proud of the backing, each in three segments along the
    curve, lit along its top, with a 1 px pillow in its middle."""
    r = FACE - d / 2
    span = (A1 - A0) - n * gap / FACE
    da = span / n
    for i in range(n):
        ac = A0 + (i + 0.5) * (A1 - A0) / n
        lo = z0 + 1 if taper else z0
        for j in (-1, 0, 1):
            a = ac + j * da / 3
            w = da / 3 * FACE * 1.15
            arcseg(k, CU, CV, a, w, r, d, lo, z1 - 1, "x7Oxide")
            arcseg(k, CU, CV, a, w, r, d, z1 - 1, z1, "k2OxideL")
        # the pillow: the middle third proud by 1 px, shorter (full height on a tapered cushion)
        pz0, pz1 = (z0, z1) if taper else (z0 + 2, z1 - 2)
        arcseg(k, CU, CV, ac, da / 3 * FACE * 1.4, r - d / 2 - 0.5, 1, pz0, pz1 - 1, "x7Oxide")
        arcseg(k, CU, CV, ac, da / 3 * FACE * 1.4, r - d / 2 - 0.5, 1, pz1 - 1, pz1, "k2OxideL")
        if taper:                                                                    # the foot steps in, dark
            arcseg(k, CU, CV, ac, da * FACE * 0.8, r, d, z0, lo, "x7OxideD")


def m1():
    k = Bench("booth_m1", FP)
    base(k)
    ring(k, 28, 1, SEAT, BACK - 1, "x7OxideD")
    pillows(k, 10, 2.5)
    table(k)
    return k.build()


def m2():
    k = Bench("booth_m2", FP)
    base(k)
    ring(k, 28, 1, SEAT, BACK - 1, "x7Bone")
    pillows(k, 8, 3)
    table(k)
    return k.build()


def m3():
    k = Bench("booth_m3", FP)
    base(k)
    ring(k, 28, 1, SEAT, BACK - 1, "x7Bone")
    pillows(k, 8, 3, taper=True)
    table(k)
    return k.build()


VARIANTS = {"m1": m1, "m2": m2, "m3": m3}


def jobs():
    return [(f"module.booth.{v}", FP, "prop", f) for v, f in VARIANTS.items()]
