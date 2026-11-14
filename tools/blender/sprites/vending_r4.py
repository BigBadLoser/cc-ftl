"""Vending machine look study, round 4 (family `vending4`, palette set vending, preview only): side-art variants for
VM1C. The user (2026-11-13) liked round 3's sweep and can as directions and locked round 3's back (vending_r3.back),
which every variant here keeps. Art on both cheeks; the camera sees the +u side.

  vm1c4 can on sweep: round 3's cream and yellow sweep with a smaller blue can graphic standing over it
  vm1c5 wave: three bands (cream, yellow, blue) swinging up the side in an S-curve
  vm1c6 tilted can: the blue can graphic tipped over at an angle, a cream splash band behind it and three drops

All in px of the tile (u, v -16..16, z up); the front (+v) faces the camera."""
import math

from .exercise_r4 import build, sweep
from .research_kit import Bench
from .vending_r3 import SIDE, along_v, back, front, sweep_art
from .vending_study import FP

X = (1.0, 0.0, 0.0)


def band(k, u, pts, w, col, t=0.3):
    sweep(k, [(u, v, z, t, w) for v, z in pts], col, p=3, n=12, steps=6, side=X)


def can(k, u, base, top, half=5, t=0.35):
    """A can graphic from `base` to `top` ((v, z) points, any slant): blue body, wine top, dark rim, cream highlight."""
    (v0, z0), (v1, z1) = base, top
    dv, dz = v1 - v0, z1 - z0
    ln = math.hypot(dv, dz)
    nv, nz = dz / ln, -dv / ln                                                     # across the can, in the side's plane

    def at(f, off=0.0):
        return v0 + dv * f + nv * off, z0 + dz * f + nz * off

    sweep(k, [(u, *at(0.0), t, half), (u, *at(1.0), t, half)], "vmItemB", p=6, n=16, steps=2, side=X)
    sweep(k, [(u, *at(0.9), t + 0.05, half + 0.1), (u, *at(1.02), t + 0.05, half + 0.1)], "vmWine", p=6, n=16,
          steps=2, side=X)                                                         # wine top
    sweep(k, [(u, *at(-0.02), t + 0.05, half + 0.1), (u, *at(0.05), t + 0.05, half + 0.1)], "vmPanel", p=6, n=16,
          steps=2, side=X)                                                         # base rim
    sweep(k, [(u, *at(0.12, half * 0.55), t + 0.08, 0.7), (u, *at(0.85, half * 0.55), t + 0.08, 0.7)], "vmCream",
          p=4, n=10, side=X)                                                       # highlight
    sweep(k, [(u, *at(0.4), t + 0.1, half * 0.62), (u, *at(0.62), t + 0.1, half * 0.62)], "vmCream", p=2.4, n=16,
          steps=2, side=X)                                                         # ring label


def art4(k, s):
    sweep_art(k, s)
    can(k, s * (SIDE + 0.2), (1, 20), (1, 46), 4.4)


def art5(k, s):
    u = s * SIDE
    band(k, u, [(6, 4), (4, 16), (-6, 30), (-8, 42), (2, 54), (4.5, 62)], 3.2, "vmCream")
    band(k, u + s * 0.05, [(1.5, 4), (-0.5, 15), (-10.5, 30), (-12, 42), (-2.5, 55), (0, 63)], 1.0, "vmItemY")
    band(k, u + s * 0.05, [(-2, 4), (-5, 14), (-13, 26)], 0.8, "vmItemB")
    band(k, u + s * 0.05, [(8, 45), (7, 52), (8, 60)], 0.8, "vmItemB")


def art6(k, s):
    u = s * SIDE
    band(k, u, [(8, 10), (2, 24), (-6, 40), (-10, 56)], 4.6, "vmCream")                # splash band
    can(k, u + s * 0.2, (5, 20), (-7, 46), 5)                                       # tipped can
    for v, z in ((-10, 49), (-12, 44), (-7.5, 56)):                                 # drops
        along_v(k, u + s * 0.3, v - 0.9, v + 0.9, z, 0.3, 1.1, "vmCream", p=2.2)


ARTS = {"vm1c4": art4, "vm1c5": art5, "vm1c6": art6}


def make(name, art):
    def f():
        k = Bench(f"vending_{name}", FP)
        front(k)
        back(k)
        for s in (-1, 1):
            art(k, s)
        return build(k)
    return f


DESIGNS = {n: make(n, a) for n, a in ARTS.items()}


def jobs():
    return [(f"module.vending4.{v}", FP, "prop", f) for v, f in DESIGNS.items()]
